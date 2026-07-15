/**
 * Elhagyott kosár kedvezmény e-mail (Resend).
 */
import type { CartSnapshotLine } from '@/lib/cart-snapshot'

const RESEND_API = 'https://api.resend.com/emails'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatHuf(amount: number): string {
  return `${amount.toLocaleString('hu-HU')} Ft`
}

export type SendAbandonedCartOfferEmailParams = {
  to: string
  name: string | null
  percent: number
  couponCode: string
  validUntil: Date
  lines: CartSnapshotLine[]
  subtotalHuf: number
}

export type SendAbandonedCartOfferEmailResult = { ok: true } | { ok: false; error: string }

async function sendViaResend(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendAbandonedCartOfferEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info(
      '[abandoned-cart-email] RESEND_API_KEY nincs – e-mail nem küldve, csak log:',
      params.to,
      params.subject
    )
    console.info('[abandoned-cart-email] Plain text preview:\n', params.text)
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
      console.error('[abandoned-cart-email] Resend error:', err)
      return { ok: false, error: err }
    }
    console.info('[abandoned-cart-email] Sent offer to', params.to)
    return { ok: true }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[abandoned-cart-email] Send failed:', err)
    return { ok: false, error: err }
  }
}

export async function sendAbandonedCartOfferEmail(
  params: SendAbandonedCartOfferEmailParams
): Promise<SendAbandonedCartOfferEmailResult> {
  const greeting = params.name?.trim() ? `Kedves ${params.name.trim()}!` : 'Kedves Vásárlónk!'
  const validUntilStr = params.validUntil.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const itemsHtml = params.lines
    .map((line) => {
      const opts: string[] = []
      if (line.options?.colorName) opts.push(line.options.colorName)
      if (line.options?.materialName) opts.push(line.options.materialName)
      const optSuffix = opts.length ? ` (${opts.join(', ')})` : ''
      return `<li>${escapeHtml(line.name)}${escapeHtml(optSuffix)} – ${line.qty} db × ${formatHuf(line.unitPriceHuf)}</li>`
    })
    .join('')

  const itemsText = params.lines
    .map((line) => {
      const opts: string[] = []
      if (line.options?.colorName) opts.push(line.options.colorName)
      if (line.options?.materialName) opts.push(line.options.materialName)
      const optSuffix = opts.length ? ` (${opts.join(', ')})` : ''
      return `- ${line.name}${optSuffix} – ${line.qty} db × ${formatHuf(line.unitPriceHuf)}`
    })
    .join('\n')

  const cartUrl = `${APP_URL}/kosar`
  const subject = `${params.percent}% kedvezmény a kosaradra – Gulumen`

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Láttuk, hogy termékeket hagytál a kosaradban. Szeretnénk segíteni a döntésben: <strong>${params.percent}% kedvezményt</strong> adunk a kosár tartalmára.</p>
    <p><strong>Kupon kód:</strong> <code style="font-size: 18px; letter-spacing: 1px;">${escapeHtml(params.couponCode)}</code></p>
    <p>Érvényes: ${escapeHtml(validUntilStr)}-ig, egyszeri felhasználásra.</p>
    <h3>Kosár tartalma</h3>
    <ul>${itemsHtml}</ul>
    <p><strong>Részösszeg:</strong> ${formatHuf(params.subtotalHuf)}</p>
    <p><a href="${cartUrl}">Kosár megnyitása és vásárlás</a></p>
    <p style="color:#666;font-size:13px;">A kupont a fizetésnél tudod megadni. Csak a fiókodhoz tartozik.</p>
  `.trim()

  const text = [
    greeting,
    '',
    `Láttuk, hogy termékeket hagytál a kosaradban. ${params.percent}% kedvezményt adunk a kosár tartalmára.`,
    '',
    `Kupon kód: ${params.couponCode}`,
    `Érvényes: ${validUntilStr}-ig`,
    '',
    'Kosár tartalma:',
    itemsText,
    '',
    `Részösszeg: ${formatHuf(params.subtotalHuf)}`,
    '',
    `Kosár: ${cartUrl}`,
  ].join('\n')

  return sendViaResend({ to: params.to, subject, html, text })
}
