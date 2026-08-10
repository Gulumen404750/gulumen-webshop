/**
 * E-mail értesítések a voice/callback flow-hoz.
 * Használja a Resend API-t (RESEND_API_KEY), címzett: ADMIN_EMAIL.
 */

import { isResendConfigured, sendMail } from '@/lib/mail'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type CallbackRequestPayload = {
  name: string
  phone: string
  topic?: string
  preferredTime?: string
}

export async function sendCallbackRequestNotification(
  payload: CallbackRequestPayload
): Promise<{ ok: boolean; error?: string }> {
  const to = process.env.ADMIN_EMAIL
  if (!to?.trim()) {
    console.info('[voice-email] ADMIN_EMAIL nincs megadva – callback kérés nem küldve:', payload)
    return { ok: true }
  }
  if (!isResendConfigured()) {
    console.info('[voice-email] RESEND_API_KEY nincs – callback kérés nem küldve')
    return { ok: true }
  }
  const subject = `[Gulumen] Visszahívás kérés: ${payload.name}`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Visszahívás kérés</title></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
  <h1>Új visszahívás kérés</h1>
  <p><strong>Név:</strong> ${escapeHtml(payload.name)}</p>
  <p><strong>Telefon:</strong> ${escapeHtml(payload.phone)}</p>
  ${payload.topic ? `<p><strong>Téma:</strong> ${escapeHtml(payload.topic)}</p>` : ''}
  ${payload.preferredTime ? `<p><strong>Preferált idősáv:</strong> ${escapeHtml(payload.preferredTime)}</p>` : ''}
  <p>– Gulumen web</p>
</body>
</html>
`.trim()
  const result = await sendMail({ to, subject, html })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}

export type CallSummaryPayload = {
  callId: string
  timestamp: string
  language: string
  mode: string
  callerNumber?: string
  consent: boolean
  summary?: string
  transcript?: string
  tags: string[]
}

export async function sendCallSummaryNotification(
  payload: CallSummaryPayload
): Promise<{ ok: boolean; error?: string }> {
  const to = process.env.ADMIN_EMAIL
  if (!to?.trim()) {
    console.info('[voice-email] ADMIN_EMAIL nincs – call summary nem küldve')
    return { ok: true }
  }
  if (!isResendConfigured()) {
    console.info('[voice-email] RESEND_API_KEY nincs – call summary nem küldve')
    return { ok: true }
  }
  const subject = `[Gulumen] Hívás összefoglaló: ${payload.callId}${payload.tags?.includes('callback_required') ? ' – VISSZAHÍVÁS KELL' : ''}`
  const transcriptBlock =
    payload.consent && payload.transcript
      ? `<h2>Átirat</h2><pre style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">${escapeHtml(payload.transcript)}</pre>`
      : '<p><em>Nincs átirat (nincs consent).</em></p>'
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Hívás összefoglaló</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 16px;">
  <h1>AI telefon hívás összefoglaló</h1>
  <p><strong>Call ID:</strong> ${escapeHtml(payload.callId)}</p>
  <p><strong>Idő:</strong> ${escapeHtml(payload.timestamp)}</p>
  <p><strong>Nyelv:</strong> ${escapeHtml(payload.language)} | <strong>Mód:</strong> ${escapeHtml(payload.mode)}</p>
  ${payload.callerNumber ? `<p><strong>Hívó:</strong> ${escapeHtml(payload.callerNumber)}</p>` : ''}
  <p><strong>Consent:</strong> ${payload.consent ? 'Igen' : 'Nem'}</p>
  ${payload.tags?.length ? `<p><strong>Címkék:</strong> ${escapeHtml(payload.tags.join(', '))}</p>` : ''}
  ${payload.summary ? `<h2>Összefoglaló</h2><p>${escapeHtml(payload.summary)}</p>` : ''}
  ${transcriptBlock}
  <p>– Gulumen voice</p>
</body>
</html>
`.trim()
  const result = await sendMail({ to, subject, html })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}
