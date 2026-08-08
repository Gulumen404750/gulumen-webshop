/**
 * Admin tömeges e-mail felhasználóknak (Resend).
 */

const RESEND_API = 'https://api.resend.com/emails'

export type BulkEmailRecipient = {
  email: string
  name: string | null
}

export type BulkEmailResult = {
  sent: number
  failed: number
  errors: string[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toHtmlFromPlain(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).replace(/\n/g, '<br/>')
      return `<p>${lines}</p>`
    })
    .join('\n')
}

async function sendOne(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info('[admin-bulk-email] RESEND_API_KEY nincs – log only:', params.to, params.subject)
    console.info('[admin-bulk-email] Preview:\n', params.text)
    return { ok: true }
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Gulumen <onboarding@resend.dev>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[admin-bulk-email] Resend error:', err)
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[admin-bulk-email] Send failed:', err)
    return { ok: false, error: err }
  }
}

export async function sendAdminBulkEmail(params: {
  recipients: BulkEmailRecipient[]
  subject: string
  body: string
}): Promise<BulkEmailResult> {
  const subject = params.subject.trim()
  const body = params.body.trim()
  const html = toHtmlFromPlain(body)
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of params.recipients) {
    const greeting = r.name?.trim() ? `Kedves ${r.name.trim()}!` : 'Kedves Vásárlónk!'
    const text = `${greeting}\n\n${body}\n\n— Gulumen`
    const fullHtml = `<p>${escapeHtml(greeting)}</p>\n${html}\n<p style="color:#666;font-size:13px;">— Gulumen</p>`

    const result = await sendOne({
      to: r.email,
      subject,
      html: fullHtml,
      text,
    })

    if (result.ok) {
      sent += 1
    } else {
      failed += 1
      if (errors.length < 10) {
        errors.push(`${r.email}: ${result.error}`)
      }
    }
  }

  return { sent, failed, errors }
}
