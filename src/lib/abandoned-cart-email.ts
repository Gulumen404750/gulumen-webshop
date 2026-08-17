/**
 * Elhagyott kosár kedvezmény / emlékeztető e-mail (Resend).
 * Marketing jellegű – leiratkozási linkkel.
 */
import type { CartSnapshotLine } from '@/lib/cart-snapshot'
import {
  ensureUnsubToken,
  marketingUnsubscribeUrl,
} from '@/lib/marketing-consent'
import { sendMailRequired } from '@/lib/mail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

async function marketingFooter(email: string): Promise<{ html: string; text: string }> {
  const token = await ensureUnsubToken(email)
  const url = marketingUnsubscribeUrl(token)
  if (!url) return { html: '', text: '' }
  return {
    html: `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/><p style="font-size:12px;color:#666">Ha nem szeretnél több marketing e-mailt kapni, <a href="${url}">iratkozz le itt</a>.</p>`,
    text: `\n\nLeiratkozás: ${url}`,
  }
}

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
  const result = await sendMailRequired(params)
  if (!result.ok) {
    return {
      ok: false,
      error: result.error.includes('RESEND_API_KEY')
        ? 'RESEND_API_KEY nincs beállítva a Railway-en – az e-mail nem ment ki (a kupon létrejött).'
        : result.error,
    }
  }
  return { ok: true }
}

export type SendAbandonedCartReminderEmailParams = {
  to: string
  name: string | null
  lines: CartSnapshotLine[]
  subtotalHuf: number
}

/** Alap rendszer-emlékeztető kupon nélkül. */
export async function sendAbandonedCartReminderEmail(
  params: SendAbandonedCartReminderEmailParams
): Promise<SendAbandonedCartOfferEmailResult> {
  const greeting = params.name?.trim() ? `Kedves ${params.name.trim()}!` : 'Kedves Vásárlónk!'

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
  const subject = 'Emlékeztető: termékek várnak a kosaradban – Gulumen'
  const footer = await marketingFooter(params.to)

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Észrevettük, hogy termékeket hagytál a kosaradban. Ha szeretnéd befejezni a vásárlást, itt folytathatod:</p>
    <h3>Kosár tartalma</h3>
    <ul>${itemsHtml}</ul>
    <p><strong>Részösszeg:</strong> ${formatHuf(params.subtotalHuf)}</p>
    <p><a href="${cartUrl}">Kosár megnyitása</a></p>
    <p style="color:#666;font-size:13px;">Ha már megvásároltad, nyugodtan hagyd figyelmen kívül ezt az e-mailt.</p>
    ${footer.html}
  `.trim()

  const text = [
    greeting,
    '',
    'Észrevettük, hogy termékeket hagytál a kosaradban. Ha szeretnéd befejezni a vásárlást, itt folytathatod:',
    '',
    'Kosár tartalma:',
    itemsText,
    '',
    `Részösszeg: ${formatHuf(params.subtotalHuf)}`,
    '',
    `Kosár: ${cartUrl}`,
    footer.text,
  ].join('\n')

  return sendViaResend({ to: params.to, subject, html, text })
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
  const footer = await marketingFooter(params.to)

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
    ${footer.html}
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
    footer.text,
  ].join('\n')

  return sendViaResend({ to: params.to, subject, html, text })
}
