/**
 * Admin belépés eszköz / geo ujjlenyomat.
 * Eszköz azonosító: SHA-256(UA + Accept-Language + Client Hints).
 * A nyers fingerprint-anyag nem kerül DB-be; a UI csak hash-prefixet kap.
 * Ország: CDN geo header (cf-ipcountry, x-vercel-ip-country, …).
 */

import { createHash } from 'crypto'
import { getClientIp, getRequestCountryCode, getUserAgent } from '@/lib/request-ip'

export const ADMIN_DEVICE_UA_MAX_LEN = 180
export const ADMIN_FINGERPRINT_PREFIX_LEN = 8

export type AdminLoginSignals = {
  fingerprint: string
  userAgent: string
  countryCode: string | null
  ip: string
}

export type AdminLoginAlertDecision = {
  newDevice: boolean
  unusualCountry: boolean
}

export function hashAdminDeviceFingerprint(material: string): string {
  return createHash('sha256').update(`gulumen-admin-device|${material}`, 'utf8').digest('hex')
}

export function fingerprintPrefix(fingerprint: string): string {
  return fingerprint.slice(0, ADMIN_FINGERPRINT_PREFIX_LEN)
}

export function collectAdminDeviceMaterial(request: Request): string {
  const ua = getUserAgent(request).slice(0, ADMIN_DEVICE_UA_MAX_LEN)
  const lang = request.headers.get('accept-language')?.split(',')[0]?.trim().toLowerCase() || ''
  const chUa = request.headers.get('sec-ch-ua')?.trim() || ''
  const chPlatform = request.headers.get('sec-ch-ua-platform')?.trim() || ''
  const chMobile = request.headers.get('sec-ch-ua-mobile')?.trim() || ''
  return `v1|${ua}|${lang}|${chUa}|${chPlatform}|${chMobile}`
}

export function extractAdminLoginSignals(request: Request): AdminLoginSignals {
  const userAgent = getUserAgent(request).slice(0, ADMIN_DEVICE_UA_MAX_LEN)
  return {
    fingerprint: hashAdminDeviceFingerprint(collectAdminDeviceMaterial(request)),
    userAgent,
    countryCode: getRequestCountryCode(request),
    ip: getClientIp(request),
  }
}

/**
 * Első ismert eszköz / ország = baseline, nincs riasztás.
 * Utána: ismeretlen fingerprint = új eszköz; ismeretlen ISO kód = szokatlan ország.
 * Hiányzó geo header nem számít szokatlan országnak.
 */
export function decideAdminLoginAlerts(input: {
  existingDeviceCount: number
  existingCountryCount: number
  deviceKnown: boolean
  countryKnown: boolean
  countryCode: string | null
}): AdminLoginAlertDecision {
  const newDevice = !input.deviceKnown && input.existingDeviceCount > 0
  const unusualCountry = Boolean(
    input.countryCode && !input.countryKnown && input.existingCountryCount > 0
  )
  return { newDevice, unusualCountry }
}

export function shouldAlertAdminLogin(decision: AdminLoginAlertDecision): boolean {
  return decision.newDevice || decision.unusualCountry
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAdminLoginAlertSubject(decision: AdminLoginAlertDecision): string {
  if (decision.newDevice && decision.unusualCountry) {
    return '[Gulumen] Admin belépés új eszközről és szokatlan országból'
  }
  if (decision.unusualCountry) {
    return '[Gulumen] Admin belépés szokatlan országból'
  }
  return '[Gulumen] Admin belépés új eszközről'
}

export function buildAdminLoginAlertHtml(input: {
  decision: AdminLoginAlertDecision
  signals: AdminLoginSignals
  at?: Date
}): string {
  const when = (input.at ?? new Date()).toISOString()
  const reasons: string[] = []
  if (input.decision.newDevice) reasons.push('új eszköz (böngésző / OS ujjlenyomat)')
  if (input.decision.unusualCountry) {
    reasons.push(`szokatlan ország (${escapeHtml(input.signals.countryCode || '?')})`)
  }
  const ua = input.signals.userAgent || '(nincs User-Agent)'
  const ip = input.signals.ip || 'unknown'
  const country = input.signals.countryCode || 'ismeretlen (nincs CDN geo header)'
  return `
    <p>Sikeres admin belépést észleltünk, ami eltér a korábbi mintától. A belépést nem blokkoltuk.</p>
    <p><strong>Ok:</strong> ${reasons.map(escapeHtml).join('; ')}</p>
    <ul>
      <li><strong>Idő (UTC):</strong> ${escapeHtml(when)}</li>
      <li><strong>IP:</strong> ${escapeHtml(ip)}</li>
      <li><strong>Ország:</strong> ${escapeHtml(country)}</li>
      <li><strong>Eszköz:</strong> ${escapeHtml(ua)}</li>
      <li><strong>Fingerprint:</strong> ${escapeHtml(fingerprintPrefix(input.signals.fingerprint))}…</li>
    </ul>
    <p>Ha nem te voltál, cseréld az <code>ADMIN_API_KEY</code> értéket, és ellenőrizd a 2FA-t.</p>
  `.trim()
}

export function buildAdminLoginAlertText(input: {
  decision: AdminLoginAlertDecision
  signals: AdminLoginSignals
}): string {
  return [
    buildAdminLoginAlertSubject(input.decision),
    `IP: ${input.signals.ip || 'unknown'}`,
    `Ország: ${input.signals.countryCode || 'ismeretlen'}`,
    `Eszköz: ${input.signals.userAgent || '–'}`,
    `Fingerprint: ${fingerprintPrefix(input.signals.fingerprint)}…`,
  ].join('\n')
}
