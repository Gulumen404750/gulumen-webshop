/**
 * Közös Resend e-mail küldő – tranzakciós és marketing levelekhez.
 * Feladó alapértelmezés: Gulumen <noreply@gulumen.com>
 *
 * Env:
 * - RESEND_API_KEY (kötelező a tényleges küldéshez)
 * - EMAIL_FROM / RESEND_FROM (opcionális felülírás)
 */
import { Resend } from 'resend'

export const DEFAULT_FROM_EMAIL = 'Gulumen <noreply@gulumen.com>'

export type SendMailParams = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  /** Feladó felülírása; alap: EMAIL_FROM / RESEND_FROM / noreply@gulumen.com */
  from?: string
  replyTo?: string
}

export type SendMailResult =
  | { ok: true; id?: string; skipped?: boolean }
  | { ok: false; error: string }

let resendClient: Resend | null = null

export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim()
  return key || null
}

export function isResendConfigured(): boolean {
  return !!getResendApiKey()
}

export function getMailFromAddress(override?: string): string {
  return (
    override?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_FROM_EMAIL
  )
}

function getResendClient(): Resend | null {
  const apiKey = getResendApiKey()
  if (!apiKey) return null
  if (!resendClient) resendClient = new Resend(apiKey)
  return resendClient
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to]
  return list.map((e) => e.trim()).filter(Boolean)
}

/**
 * Tranzakciós / rendszer e-mail küldése Resenddel.
 * Ha nincs RESEND_API_KEY: nem dob hibát, { ok: true, skipped: true }.
 */
export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  const recipients = normalizeRecipients(params.to)
  if (recipients.length === 0) {
    return { ok: false, error: 'Nincs címzett (to)' }
  }
  if (!params.subject?.trim()) {
    return { ok: false, error: 'Nincs tárgy (subject)' }
  }
  if (!params.html?.trim() && !params.text?.trim()) {
    return { ok: false, error: 'Nincs e-mail tartalom (html/text)' }
  }

  const client = getResendClient()
  if (!client) {
    console.info(
      '[mail] RESEND_API_KEY nincs – e-mail nem küldve (skipped):',
      recipients.join(', '),
      params.subject
    )
    if (params.text) {
      console.info('[mail] Plain text preview:\n', params.text.slice(0, 2000))
    }
    return { ok: true, skipped: true }
  }

  const from = getMailFromAddress(params.from)

  try {
    const payload = {
      from,
      to: recipients,
      subject: params.subject,
      html: params.html?.trim() ? params.html : `<pre>${params.text ?? ''}</pre>`,
      ...(params.text?.trim() ? { text: params.text } : {}),
      ...(params.replyTo?.trim() ? { replyTo: params.replyTo } : {}),
    }

    const { data, error } = await client.emails.send(payload)

    if (error) {
      const message = error.message || JSON.stringify(error)
      console.error('[mail] Resend error:', message)
      return { ok: false, error: message }
    }

    console.info('[mail] Sent:', recipients.join(', '), params.subject, data?.id ?? '')
    return { ok: true, id: data?.id }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[mail] Send failed:', err)
    return { ok: false, error: err }
  }
}

/**
 * Szigorú küldés: hiányzó API kulcs esetén { ok: false }.
 * Használd, ha a hívónak jelezni kell, hogy az e-mail nem ment ki.
 */
export async function sendMailRequired(params: SendMailParams): Promise<SendMailResult> {
  if (!isResendConfigured()) {
    console.error(
      '[mail] RESEND_API_KEY hiányzik – e-mail nem küldve:',
      normalizeRecipients(params.to).join(', '),
      params.subject
    )
    if (params.text) {
      console.info('[mail] Plain text preview:\n', params.text.slice(0, 2000))
    }
    return {
      ok: false,
      error: 'RESEND_API_KEY nincs beállítva – az e-mail nem ment ki.',
    }
  }
  return sendMail(params)
}
