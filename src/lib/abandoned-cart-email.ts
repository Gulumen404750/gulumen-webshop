/**
 * Elhagyott kosár kedvezmény / emlékeztető e-mail (Resend).
 * Sötét Gulumen arculat + tokenes kosár-visszaállítás.
 */
import type { CartSnapshotLine } from '@/lib/cart-snapshot'
import {
  ensureUnsubToken,
  marketingUnsubscribeUrl,
} from '@/lib/marketing-consent'
import { sendMailRequired } from '@/lib/mail'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu').replace(/\/$/, '')

const BG = '#0b1220'
const CARD = '#1e293b'
const ACCENT = '#38bdf8'
const TEXT = '#e2e8f0'
const MUTED = '#94a3b8'
const BORDER = '#334155'

async function marketingFooter(email: string): Promise<{ html: string; text: string }> {
  const token = await ensureUnsubToken(email)
  const url = marketingUnsubscribeUrl(token)
  if (!url) return { html: '', text: '' }
  return {
    html: `<tr><td style="padding:24px 28px 8px;border-top:1px solid ${BORDER}"><p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED}">Ha nem szeretnél több marketing e-mailt kapni, <a href="${url}" style="color:${ACCENT}">iratkozz le itt</a>.</p></td></tr>`,
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

function optionSuffix(line: CartSnapshotLine): string {
  const opts: string[] = []
  if (line.options?.colorName) opts.push(line.options.colorName)
  if (line.options?.materialName) opts.push(line.options.materialName)
  return opts.length ? ` (${opts.join(', ')})` : ''
}

function productCardsHtml(lines: CartSnapshotLine[]): string {
  return lines
    .map((line) => {
      const name = `${escapeHtml(line.name)}${escapeHtml(optionSuffix(line))}`
      const img = line.image
        ? `<img src="${escapeHtml(line.image)}" alt="" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:cover;border-radius:10px;background:#0f172a;border:1px solid ${BORDER}" />`
        : `<div style="width:88px;height:88px;border-radius:10px;background:#0f172a;border:1px solid ${BORDER}"></div>`
      return `
        <tr>
          <td style="padding:0 0 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px">
              <tr>
                <td style="padding:12px;width:88px;vertical-align:top">${img}</td>
                <td style="padding:12px 16px 12px 4px;vertical-align:middle">
                  <p style="margin:0 0 6px;font-size:16px;line-height:1.35;color:${TEXT};font-weight:600">${name}</p>
                  <p style="margin:0;font-size:13px;color:${MUTED}">${line.qty} db × ${formatHuf(line.unitPriceHuf)}</p>
                  <p style="margin:6px 0 0;font-size:15px;color:${ACCENT};font-weight:700">${formatHuf(line.lineTotalHuf)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    })
    .join('')
}

function productCardsText(lines: CartSnapshotLine[]): string {
  return lines
    .map((line) => `- ${line.name}${optionSuffix(line)} – ${line.qty} db × ${formatHuf(line.unitPriceHuf)}`)
    .join('\n')
}

function wrapGulumenEmail(innerRows: string): string {
  return `
  <div style="margin:0;padding:0;background:${BG}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};margin:0;padding:24px 0">
      <tr>
        <td align="center" style="padding:0 12px">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#111827;border:1px solid ${BORDER};border-radius:20px;overflow:hidden;font-family:Inter,Segoe UI,system-ui,sans-serif;color:${TEXT}">
            <tr>
              <td style="padding:22px 28px;background:#0f172a;border-bottom:1px solid ${BORDER}">
                <p style="margin:0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:${ACCENT};font-weight:700">Gulumen</p>
              </td>
            </tr>
            ${innerRows}
          </table>
        </td>
      </tr>
    </table>
  </div>`.trim()
}

function ctaButtonHtml(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${ACCENT};color:#0b1220;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:800;font-size:16px;box-shadow:0 0 24px rgba(56,189,248,0.45)">${escapeHtml(label)}</a>`
}

export type SendAbandonedCartOfferEmailParams = {
  to: string
  name: string | null
  percent: number
  couponCode: string
  validUntil: Date
  lines: CartSnapshotLine[]
  subtotalHuf: number
  restoreUrl: string
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
  restoreUrl: string
}

export function buildAbandonedCartReminderEmail(params: {
  greeting: string
  lines: CartSnapshotLine[]
  subtotalHuf: number
  restoreUrl: string
  footerHtml: string
}): { subject: string; html: string } {
  const inner = `
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT}">${escapeHtml(params.greeting)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${MUTED}">Észrevettük, hogy termékeket hagytál a kosaradban. Egy kattintással visszaállítjuk a kosarat, és folytathatod a vásárlást.</p>
    </td></tr>
    <tr><td style="padding:0 28px 8px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${productCardsHtml(params.lines)}</table>
    </td></tr>
    <tr><td style="padding:4px 28px 8px">
      <p style="margin:0;font-size:16px;color:${TEXT}"><strong>Részösszeg:</strong> ${formatHuf(params.subtotalHuf)}</p>
    </td></tr>
    <tr><td style="padding:18px 28px 8px">${ctaButtonHtml(params.restoreUrl, 'Kosár megnyitása és vásárlás')}</td></tr>
    <tr><td style="padding:8px 28px 24px">
      <p style="margin:0;font-size:13px;color:${MUTED}">Ha már megvásároltad, nyugodtan hagyd figyelmen kívül ezt az e-mailt.</p>
    </td></tr>
    ${params.footerHtml}
  `
  return {
    subject: 'Emlékeztető: termékek várnak a kosaradban – Gulumen',
    html: wrapGulumenEmail(inner),
  }
}

export function buildAbandonedCartOfferEmail(params: {
  greeting: string
  percent: number
  couponCode: string
  validUntilStr: string
  lines: CartSnapshotLine[]
  subtotalHuf: number
  restoreUrl: string
  footerHtml: string
}): { subject: string; html: string } {
  const inner = `
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT}">${escapeHtml(params.greeting)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MUTED}">Láttuk, hogy termékeket hagytál a kosaradban. A lenti gombbal visszaállítjuk a kosarat, és <strong style="color:${ACCENT}">${params.percent}% kedvezmény</strong> automatikusan érvényesül a kosárban hagyott termékekre és darabszámra.</p>
      <p style="margin:0 0 18px;display:inline-block;background:rgba(56,189,248,0.12);border:1px solid ${ACCENT};color:${ACCENT};padding:8px 14px;border-radius:999px;font-weight:800">${params.percent}% kedvezmény · ${escapeHtml(params.validUntilStr)}-ig</p>
    </td></tr>
    <tr><td style="padding:0 28px 8px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${productCardsHtml(params.lines)}</table>
    </td></tr>
    <tr><td style="padding:4px 28px 8px">
      <p style="margin:0;font-size:16px;color:${TEXT}"><strong>Részösszeg:</strong> ${formatHuf(params.subtotalHuf)}</p>
      <p style="margin:10px 0 0;font-size:13px;color:${MUTED}">A kedvezmény csak ezekre a termékekre és pontos darabszámra vonatkozik. Többlet darab és új termék teljes áron számít; azokra pontot vagy külön kupont használhatsz. A hűségkedvezmény változatlanul érvényes. Ha a kedvezmények után a kosár nem éri el az ingyenes szállítási határt, a szállítási díj fizetendő.</p>
    </td></tr>
    <tr><td style="padding:18px 28px 8px">${ctaButtonHtml(params.restoreUrl, 'Kosár megnyitása és vásárlás')}</td></tr>
    <tr><td style="padding:8px 28px 24px">
      <p style="margin:0;font-size:12px;color:${MUTED}">Referenciakód: <span style="color:${TEXT}">${escapeHtml(params.couponCode)}</span> – nem kell begépelned, a rendszer automatikusan aktiválja.</p>
    </td></tr>
    ${params.footerHtml}
  `
  return {
    subject: `${params.percent}% kedvezmény a kosaradra – Gulumen`,
    html: wrapGulumenEmail(inner),
  }
}

/** Alap rendszer-emlékeztető kupon nélkül. */
export async function sendAbandonedCartReminderEmail(
  params: SendAbandonedCartReminderEmailParams
): Promise<SendAbandonedCartOfferEmailResult> {
  const greeting = params.name?.trim() ? `Kedves ${params.name.trim()}!` : 'Kedves Vásárlónk!'
  const restoreUrl = params.restoreUrl || `${APP_URL}/kosar`
  const footer = await marketingFooter(params.to)
  const built = buildAbandonedCartReminderEmail({
    greeting,
    lines: params.lines,
    subtotalHuf: params.subtotalHuf,
    restoreUrl,
    footerHtml: footer.html,
  })
  const itemsText = productCardsText(params.lines)
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
    `Kosár: ${restoreUrl}`,
    footer.text,
  ].join('\n')

  return sendViaResend({ to: params.to, subject: built.subject, html: built.html, text })
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
  const restoreUrl = params.restoreUrl || `${APP_URL}/kosar`
  const footer = await marketingFooter(params.to)
  const built = buildAbandonedCartOfferEmail({
    greeting,
    percent: params.percent,
    couponCode: params.couponCode,
    validUntilStr,
    lines: params.lines,
    subtotalHuf: params.subtotalHuf,
    restoreUrl,
    footerHtml: footer.html,
  })

  const itemsText = productCardsText(params.lines)
  const text = [
    greeting,
    '',
    `Láttuk, hogy termékeket hagytál a kosaradban. ${params.percent}% kedvezmény automatikusan érvényesül a kosárban hagyott termékekre.`,
    '',
    `Referenciakód: ${params.couponCode} (nem kell begépelned)`,
    `Érvényes: ${validUntilStr}-ig`,
    '',
    'Kosár tartalma:',
    itemsText,
    '',
    `Részösszeg: ${formatHuf(params.subtotalHuf)}`,
    '',
    `Kosár: ${restoreUrl}`,
    footer.text,
  ].join('\n')

  return sendViaResend({ to: params.to, subject: built.subject, html: built.html, text })
}
