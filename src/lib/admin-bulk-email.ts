/**
 * Admin tömeges e-mail felhasználóknak (Resend).
 * Marketing levelekhez leiratkozási link; tranzakciós levelekhez nem.
 */

import {
  ensureUnsubToken,
  marketingUnsubscribeUrl,
} from '@/lib/marketing-consent'
import { sendMail } from '@/lib/mail'

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
  const result = await sendMail(params)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}

export async function sendAdminBulkEmail(params: {
  recipients: BulkEmailRecipient[]
  subject: string
  body: string
  purpose?: 'marketing' | 'transactional'
}): Promise<BulkEmailResult> {
  const subject = params.subject.trim()
  const body = params.body.trim()
  const html = toHtmlFromPlain(body)
  const purpose = params.purpose ?? 'marketing'
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of params.recipients) {
    const greeting = r.name?.trim() ? `Kedves ${r.name.trim()}!` : 'Kedves Vásárlónk!'
    let unsubFooterHtml = ''
    let unsubFooterText = ''
    if (purpose === 'marketing') {
      const token = await ensureUnsubToken(r.email)
      const unsubUrl = marketingUnsubscribeUrl(token)
      if (unsubUrl) {
        unsubFooterHtml = `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/><p style="font-size:12px;color:#666">Ha nem szeretnél több marketing e-mailt kapni, <a href="${unsubUrl}">iratkozz le itt</a>.</p>`
        unsubFooterText = `\n\nLeiratkozás: ${unsubUrl}`
      }
    }

    const text = `${greeting}\n\n${body}\n\n— Gulumen${unsubFooterText}`
    const fullHtml = `<p>${escapeHtml(greeting)}</p>\n${html}\n<p style="color:#666;font-size:13px;">— Gulumen</p>${unsubFooterHtml}`

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
