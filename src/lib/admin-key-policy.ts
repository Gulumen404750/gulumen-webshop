/**
 * Admin API kulcs életciklus: mustChangeKey + opcionális max életkor.
 * A nyers kulcs soha nem kerül a DB-be, csak SHA-256 fingerprint.
 * DB hiány / query hiba: fail-open (ne zárja ki az admint migráció előtt).
 */

import { createHash, timingSafeEqual } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'
import { logger } from '@/lib/logger'

export const DEFAULT_ADMIN_KEY_MAX_AGE_DAYS = 90

export type AdminKeyPolicyDecision =
  | { ok: true; rotated: boolean }
  | { ok: false; reason: 'must_change_key' | 'key_expired' }

export type AdminKeyPolicyStatus = {
  mustChangeKey: boolean
  keyConfirmedAt: Date | null
  maxAgeDays: number | null
  daysOld: number | null
  fingerprintPrefix: string | null
}

export function hashAdminApiKeyFingerprint(apiKey: string): string {
  return createHash('sha256').update(`gulumen-admin-keyfp|${apiKey}`, 'utf8').digest('hex')
}

export function fingerprintsMatch(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/** Alap: 90 nap. 0 = nincs max életkor. Hiányzó / érvénytelen → 90. */
export function getAdminKeyMaxAgeDays(
  env: { ADMIN_KEY_MAX_AGE_DAYS?: string } = process.env as { ADMIN_KEY_MAX_AGE_DAYS?: string }
): number | null {
  const raw = env.ADMIN_KEY_MAX_AGE_DAYS
  if (raw === undefined || raw.trim() === '') return DEFAULT_ADMIN_KEY_MAX_AGE_DAYS
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return DEFAULT_ADMIN_KEY_MAX_AGE_DAYS
  if (n === 0) return null
  return n
}

export function isAdminKeyExpired(
  keyConfirmedAt: Date | null | undefined,
  now = new Date(),
  maxAgeDays: number | null = getAdminKeyMaxAgeDays()
): boolean {
  if (!maxAgeDays || !keyConfirmedAt) return false
  const ageMs = now.getTime() - keyConfirmedAt.getTime()
  return ageMs >= maxAgeDays * 24 * 60 * 60 * 1000
}

export const MUST_CHANGE_KEY_MESSAGE =
  'Az ADMIN_API_KEY-t cserélni kell. Állíts új kulcsot a Railway / env Variables-ben, majd az újjal lépj be. A régi sessionök a csere után érvénytelenek.'

export async function evaluateAdminKeyPolicy(apiKey: string): Promise<AdminKeyPolicyDecision> {
  if (!isDbConfigured()) return { ok: true, rotated: false }
  try {
    const fp = hashAdminApiKeyFingerprint(apiKey)
    const row = await prisma.admin.findUnique({
      where: { id: ADMIN_RECORD_ID },
      select: { mustChangeKey: true, apiKeyFingerprint: true, keyConfirmedAt: true },
    })
    if (!row || !row.apiKeyFingerprint) {
      return { ok: true, rotated: false }
    }
    const sameKey = fingerprintsMatch(row.apiKeyFingerprint, fp)
    if (row.mustChangeKey && sameKey) {
      return { ok: false, reason: 'must_change_key' }
    }
    if (sameKey && isAdminKeyExpired(row.keyConfirmedAt)) {
      return { ok: false, reason: 'key_expired' }
    }
    return { ok: true, rotated: !sameKey }
  } catch (err) {
    logger.error({ err }, 'admin key policy evaluate failed')
    return { ok: true, rotated: false }
  }
}

export async function recordAdminKeyAccepted(apiKey: string): Promise<void> {
  if (!isDbConfigured()) return
  const fp = hashAdminApiKeyFingerprint(apiKey)
  const now = new Date()
  try {
    const row = await prisma.admin.findUnique({
      where: { id: ADMIN_RECORD_ID },
      select: { apiKeyFingerprint: true },
    })
    if (row?.apiKeyFingerprint && fingerprintsMatch(row.apiKeyFingerprint, fp)) {
      return
    }
    await prisma.admin.upsert({
      where: { id: ADMIN_RECORD_ID },
      create: {
        id: ADMIN_RECORD_ID,
        apiKeyFingerprint: fp,
        keyConfirmedAt: now,
        mustChangeKey: false,
      },
      update: {
        apiKeyFingerprint: fp,
        keyConfirmedAt: now,
        mustChangeKey: false,
      },
    })
  } catch (err) {
    logger.error({ err }, 'admin key fingerprint save failed')
  }
}

export async function getAdminKeyPolicyStatus(): Promise<AdminKeyPolicyStatus> {
  const maxAgeDays = getAdminKeyMaxAgeDays()
  const empty: AdminKeyPolicyStatus = {
    mustChangeKey: false,
    keyConfirmedAt: null,
    maxAgeDays,
    daysOld: null,
    fingerprintPrefix: null,
  }
  if (!isDbConfigured()) return empty
  try {
    const row = await prisma.admin.findUnique({
      where: { id: ADMIN_RECORD_ID },
      select: { mustChangeKey: true, apiKeyFingerprint: true, keyConfirmedAt: true },
    })
    if (!row) return empty
    const daysOld =
      row.keyConfirmedAt != null
        ? Math.floor((Date.now() - row.keyConfirmedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null
    return {
      mustChangeKey: row.mustChangeKey,
      keyConfirmedAt: row.keyConfirmedAt,
      maxAgeDays,
      daysOld,
      fingerprintPrefix: row.apiKeyFingerprint ? row.apiKeyFingerprint.slice(0, 8) : null,
    }
  } catch (err) {
    logger.error({ err }, 'admin key policy status failed')
    return empty
  }
}

export async function setAdminMustChangeKey(mustChangeKey: boolean): Promise<void> {
  await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      mustChangeKey,
    },
    update: { mustChangeKey },
  })
}
