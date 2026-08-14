/**
 * Rövid életű admin jelszó-reset token (SHA-256 hash a DB-ben, nyers érték csak e-mailben).
 * 2. csatorna: ADMIN_EMAIL (Resend). Ha 2FA aktív, a confirm TOTP-t is kér.
 */

import { createHash, randomBytes } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { sendMailRequired } from '@/lib/mail'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'
import { logger } from '@/lib/logger'

export const ADMIN_PASSWORD_RESET_TTL_MS = 15 * 60 * 1000
export const ADMIN_PASSWORD_RESET_GENERIC_MESSAGE =
  'Ha a visszaállítás elérhető, elküldtük a linket az admin e-mail címre.'

export type AdminResetToken = {
  raw: string
  hash: string
  expiresAt: Date
}

export function hashAdminResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function createAdminResetToken(
  now = new Date(),
  ttlMs = ADMIN_PASSWORD_RESET_TTL_MS
): AdminResetToken {
  const raw = randomBytes(32).toString('base64url')
  return {
    raw,
    hash: hashAdminResetToken(raw),
    expiresAt: new Date(now.getTime() + ttlMs),
  }
}

export function isAdminResetTokenExpired(
  expiresAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= now.getTime()
}

export function getAdminResetAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com').replace(/\/$/, '')
}

export function buildAdminResetUrl(rawToken: string, baseUrl = getAdminResetAppBaseUrl()): string {
  const url = new URL('/admin/reset', `${baseUrl}/`)
  url.searchParams.set('token', rawToken)
  return url.toString()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAdminResetEmailHtml(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl)
  return `
    <p>Admin jelszó-visszaállítást kértél a Gulumen fiókhoz.</p>
    <p>A link <strong>15 percig</strong> érvényes, és egyszer használható. Ha a 2FA be van kapcsolva, a jelszó megadásakor a hitelesítő alkalmazás kódja is kell.</p>
    <p><a href="${safeUrl}">Új jelszó beállítása</a></p>
    <p>Ha nem te kérted, hagyd figyelmen kívül ezt a levelet. Az API kulcs (env) továbbra is vészhelyzeti belépés.</p>
  `.trim()
}

export function getAdminResetMailbox(): string | null {
  return process.env.ADMIN_EMAIL?.trim() || null
}

export async function persistAdminResetToken(hash: string, expiresAt: Date): Promise<void> {
  await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: expiresAt,
    },
    update: {
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: expiresAt,
    },
  })
}

export async function clearAdminResetToken(): Promise<void> {
  if (!isDbConfigured()) return
  try {
    await prisma.admin.updateMany({
      where: { id: ADMIN_RECORD_ID },
      data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    })
  } catch (err) {
    logger.error({ err }, 'admin reset token clear failed')
  }
}

export type IssueAdminResetEmailResult =
  | { issued: false; reason: 'unconfigured' | 'no_password' }
  | { issued: true }
  | { issued: false; reason: 'send_failed' }

/**
 * Token csak akkor marad a DB-ben, ha az e-mail kiment.
 * A hívó mindig ugyanazt a választ adja a kliensnek (nincs enumeráció).
 */
export async function issueAdminPasswordResetEmail(): Promise<IssueAdminResetEmailResult> {
  const to = getAdminResetMailbox()
  if (!isDbConfigured() || !to) {
    return { issued: false, reason: 'unconfigured' }
  }

  const row = await prisma.admin.findUnique({
    where: { id: ADMIN_RECORD_ID },
    select: { passwordHash: true },
  })
  if (!row?.passwordHash?.trim()) {
    return { issued: false, reason: 'no_password' }
  }

  const token = createAdminResetToken()
  await persistAdminResetToken(token.hash, token.expiresAt)

  const resetUrl = buildAdminResetUrl(token.raw)
  const sent = await sendMailRequired({
    to,
    subject: '[Gulumen] Admin jelszó visszaállítása',
    html: buildAdminResetEmailHtml(resetUrl),
  })

  if (!sent.ok) {
    await clearAdminResetToken()
    logger.error({ error: sent.error }, 'admin password reset email failed')
    return { issued: false, reason: 'send_failed' }
  }

  return { issued: true }
}

export type AdminResetRecord = {
  passwordHash: string | null
  passwordResetTokenHash: string | null
  passwordResetExpiresAt: Date | null
  isTwoFactorEnabled: boolean
  totpSecret: string | null
}

export async function findAdminForPasswordReset(): Promise<AdminResetRecord | null> {
  if (!isDbConfigured()) return null
  const row = await prisma.admin.findUnique({
    where: { id: ADMIN_RECORD_ID },
    select: {
      passwordHash: true,
      passwordResetTokenHash: true,
      passwordResetExpiresAt: true,
      isTwoFactorEnabled: true,
      totpSecret: true,
    },
  })
  return row
}

export function resetTokenMatches(
  rawToken: string,
  storedHash: string | null | undefined
): boolean {
  if (!rawToken || !storedHash) return false
  const provided = hashAdminResetToken(rawToken)
  if (provided.length !== storedHash.length) return false
  let out = 0
  for (let i = 0; i < provided.length; i++) {
    out |= provided.charCodeAt(i) ^ storedHash.charCodeAt(i)
  }
  return out === 0
}
