/**
 * Admin e-mail gyanús / zárolt belépéskor (Resend, ADMIN_EMAIL).
 */

import { sendMail } from '@/lib/mail'
import { logger } from '@/lib/logger'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function redactEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return '***'
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const keep = local.slice(0, 1)
  return `${keep}***@${domain}`
}

export function getAdminAlertEmail(): string | null {
  const to = process.env.ADMIN_EMAIL?.trim()
  return to || null
}

export type SuspiciousLoginAlert = {
  kind: 'user' | 'admin'
  email?: string
  ip: string
  userAgent?: string | null
  failedCount: number
  lockedUntil: Date
}

export function buildSuspiciousLoginAlertEmail(payload: SuspiciousLoginAlert): {
  subject: string
  html: string
  text: string
} {
  const who =
    payload.kind === 'admin'
      ? 'Admin belépés'
      : `Felhasználói fiók (${payload.email ? redactEmail(payload.email) : 'ismeretlen'})`
  const until = payload.lockedUntil.toISOString()
  const ua = payload.userAgent?.trim() || '–'
  const subject = `[Gulumen] Gyanús belépés – fiók zárolva (${payload.kind})`
  const text = [
    'Gyanús belépési kísérletek miatt fiókzárolás lépett életbe.',
    `Típus: ${who}`,
    `IP: ${payload.ip}`,
    `Hibás kísérletek: ${payload.failedCount}`,
    `Zárolva eddig: ${until}`,
    `User-Agent: ${ua}`,
  ].join('\n')
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Gyanús belépés</title></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
  <h1>Gyanús belépés – fiókzárolás</h1>
  <p>Több sikertelen belépés után a rendszer zárolta a fiókot.</p>
  <p><strong>Típus:</strong> ${escapeHtml(who)}</p>
  <p><strong>IP:</strong> ${escapeHtml(payload.ip)}</p>
  <p><strong>Hibás kísérletek:</strong> ${payload.failedCount}</p>
  <p><strong>Zárolva eddig:</strong> ${escapeHtml(until)}</p>
  <p><strong>User-Agent:</strong> ${escapeHtml(ua)}</p>
  <p>– Gulumen</p>
</body>
</html>
`.trim()
  return { subject, html, text }
}

export async function sendSuspiciousLoginAlert(
  payload: SuspiciousLoginAlert
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const to = getAdminAlertEmail()
  if (!to) {
    logger.warn({ kind: payload.kind, ip: payload.ip }, 'ADMIN_EMAIL unset; lockout alert not sent')
    return { ok: true, skipped: true }
  }
  const { subject, html, text } = buildSuspiciousLoginAlertEmail(payload)
  const result = await sendMail({ to, subject, html, text })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, skipped: result.skipped }
}
