/**
 * Sikeres admin belépés után: eszköz/ország rögzítése + riasztó e-mail új mintánál.
 * A belépést nem blokkolja (hiba esetén csak log).
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { sendMailRequired } from '@/lib/mail'
import { logAdminAction } from '@/lib/admin-audit'
import { logger } from '@/lib/logger'
import {
  buildAdminLoginAlertHtml,
  buildAdminLoginAlertSubject,
  decideAdminLoginAlerts,
  extractAdminLoginSignals,
  shouldAlertAdminLogin,
  type AdminLoginAlertDecision,
  type AdminLoginSignals,
} from '@/lib/admin-login-fingerprint'

export type RecordAdminLoginFingerprintResult = {
  skipped?: boolean
  newDevice: boolean
  unusualCountry: boolean
  alerted: boolean
  countryCode: string | null
}

function getAlertMailbox(): string | null {
  return process.env.ADMIN_EMAIL?.trim() || null
}

async function sendLoginAlert(
  decision: AdminLoginAlertDecision,
  signals: AdminLoginSignals
): Promise<boolean> {
  const to = getAlertMailbox()
  if (!to) {
    logger.warn('admin login fingerprint alert skipped: ADMIN_EMAIL missing')
    return false
  }
  const sent = await sendMailRequired({
    to,
    subject: buildAdminLoginAlertSubject(decision),
    html: buildAdminLoginAlertHtml({ decision, signals }),
  })
  if (!sent.ok) {
    logger.error({ error: sent.error }, 'admin login fingerprint alert email failed')
    return false
  }
  return true
}

export async function recordAdminLoginFingerprint(
  request: Request
): Promise<RecordAdminLoginFingerprintResult> {
  const empty: RecordAdminLoginFingerprintResult = {
    newDevice: false,
    unusualCountry: false,
    alerted: false,
    countryCode: null,
  }
  if (!isDbConfigured()) {
    return { ...empty, skipped: true }
  }

  const signals = extractAdminLoginSignals(request)
  const now = new Date()

  const [device, country, existingDeviceCount, existingCountryCount] = await Promise.all([
    prisma.adminLoginDevice.findUnique({
      where: { fingerprint: signals.fingerprint },
      select: { id: true },
    }),
    signals.countryCode
      ? prisma.adminLoginCountry.findUnique({
          where: { countryCode: signals.countryCode },
          select: { countryCode: true },
        })
      : Promise.resolve(null),
    prisma.adminLoginDevice.count(),
    prisma.adminLoginCountry.count(),
  ])

  const decision = decideAdminLoginAlerts({
    existingDeviceCount,
    existingCountryCount,
    deviceKnown: Boolean(device),
    countryKnown: Boolean(country),
    countryCode: signals.countryCode,
  })

  await prisma.adminLoginDevice.upsert({
    where: { fingerprint: signals.fingerprint },
    create: {
      fingerprint: signals.fingerprint,
      userAgent: signals.userAgent || null,
      lastCountry: signals.countryCode,
      lastIp: signals.ip === 'unknown' ? null : signals.ip,
      lastSeenAt: now,
      loginCount: 1,
    },
    update: {
      userAgent: signals.userAgent || null,
      lastCountry: signals.countryCode,
      lastIp: signals.ip === 'unknown' ? null : signals.ip,
      lastSeenAt: now,
      loginCount: { increment: 1 },
    },
  })

  if (signals.countryCode) {
    await prisma.adminLoginCountry.upsert({
      where: { countryCode: signals.countryCode },
      create: {
        countryCode: signals.countryCode,
        lastSeenAt: now,
        loginCount: 1,
      },
      update: {
        lastSeenAt: now,
        loginCount: { increment: 1 },
      },
    })
  }

  let alerted = false
  if (shouldAlertAdminLogin(decision)) {
    alerted = await sendLoginAlert(decision, signals)
    await logAdminAction({
      action: 'login_fingerprint_alert',
      success: true,
      request,
      details: {
        newDevice: decision.newDevice,
        unusualCountry: decision.unusualCountry,
        countryCode: signals.countryCode,
        alerted,
      },
    })
  }

  return {
    newDevice: decision.newDevice,
    unusualCountry: decision.unusualCountry,
    alerted,
    countryCode: signals.countryCode,
  }
}

/** Belépési útvonalak: hiba ne buktassa a session kiadását. */
export async function recordAdminLoginFingerprintSafe(request: Request): Promise<void> {
  try {
    await recordAdminLoginFingerprint(request)
  } catch (err) {
    logger.error({ err }, 'admin login fingerprint record failed')
  }
}
