/**
 * Rendelés megerősítő e-mail (Resend). Webhook (checkout.session.completed) után hívjuk.
 * Ha nincs RESEND_API_KEY, csak logol – nem dob hibát.
 */

import type { Order } from './orders'
import { getOrderById, getOrdersByGroupId } from './orders'
import { prisma, isDbConfigured } from './prisma'
import { FREE_SHIPPING_THRESHOLD } from './checkout'

const RESEND_API = 'https://api.resend.com/emails'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
const CONTACT_URL = `${APP_URL}/kapcsolat`
const RETURNS_URL = `${APP_URL}/visszakuldes`
const SHIPPING_URL = `${APP_URL}/szallitas`

const SENT_EMAIL_KEY_PREFIX = 'order_confirmation_sent:'
const SENT_EMAILS_FILE = 'data/sent-order-emails.json'

const SUCCESS_STATUSES = new Set(['paid', 'sourcing_pending', 'fulfilled'])

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

function orderShippingHuf(order: Order): number {
  const merchandise = Math.max(0, order.subtotalHuf - order.discountHuf - (order.pointsDiscountHuf ?? 0))
  return Math.max(0, order.totalHuf - merchandise)
}

function orderBlockTitle(order: Order): string {
  if (order.orderType === 'in_stock') return 'Raktári rendelés'
  if (order.orderType === 'sourcing') return 'Beszerzéses rendelés'
  const hasStock = order.items.some((i) => i.fulfillmentType === 'stock')
  const hasProcurement = order.items.some((i) => i.fulfillmentType === 'procurement')
  if (hasStock && !hasProcurement) return 'Raktári rendelés'
  if (hasProcurement && !hasStock) return 'Beszerzéses rendelés'
  return 'Rendelés'
}

function orderFulfillmentText(order: Order): string {
  if (order.orderType === 'in_stock') {
    return 'Készleten lévő termékek: a fizetés után 24–48 órán belül feladásra kerül.'
  }
  if (order.orderType === 'sourcing') {
    return 'Beszerzésre rendelt termékek: feladás beszerzést követően 7–14 munkanapon belül.'
  }
  const hasStock = order.items.some((i) => i.fulfillmentType === 'stock')
  const hasProcurement = order.items.some((i) => i.fulfillmentType === 'procurement')
  const parts: string[] = []
  if (hasStock) parts.push('Készleten lévő termékek: a fizetés után 24–48 órán belül feladásra kerül.')
  if (hasProcurement) parts.push('Beszerzésre rendelt termékek: feladás beszerzést követően 7–14 munkanapon belül.')
  return parts.join(' ') || 'Szállítás: Posta, GLS, Foxpost, DPD.'
}

function buildShippingInfoSection(): string {
  return `
  <h2>Szállítási információk</h2>
  <ul>
    <li>Szállítók: Posta, GLS, Foxpost, DPD</li>
    <li>Ingyenes szállítás ${formatHuf(FREE_SHIPPING_THRESHOLD)} feletti rendelés esetén</li>
    <li>Személyes átvétel nem lehetséges</li>
  </ul>
  <p><a href="${SHIPPING_URL}">Részletes szállítási feltételek</a></p>
`.trim()
}

function buildOrderBlockHtml(order: Order): string {
  const itemsList = order.items
    .map(
      (i) =>
        `<li>${escapeHtml(i.name || i.productId)} – ${i.qty} db × ${formatHuf(i.priceHuf)}</li>`
    )
    .join('')
  const shipping = orderShippingHuf(order)
  const discountParts: string[] = []
  if (order.discountHuf > 0) {
    discountParts.push(`<li>Kedvezmény: −${formatHuf(order.discountHuf)}</li>`)
  }
  if ((order.pointsDiscountHuf ?? 0) > 0) {
    discountParts.push(
      `<li>Pont kedvezmény (${order.pointsUsed ?? 0} pont): −${formatHuf(order.pointsDiscountHuf ?? 0)}</li>`
    )
  }

  return `
  <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <h2 style="margin-top: 0;">${escapeHtml(orderBlockTitle(order))}</h2>
    <p><strong>Rendelés azonosító:</strong> ${escapeHtml(order.id)}</p>
    <h3>Rendelt tételek</h3>
    <ul>${itemsList}</ul>
    <ul style="list-style: none; padding-left: 0;">
      <li>Részösszeg: ${formatHuf(order.subtotalHuf)}</li>
      ${discountParts.join('\n      ')}
      <li>Szállítási díj: ${shipping === 0 ? 'Ingyenes' : formatHuf(shipping)}</li>
      <li><strong>Fizetendő összeg:</strong> ${formatHuf(order.totalHuf)}</li>
    </ul>
    <p><strong>Várható teljesítés:</strong> ${escapeHtml(orderFulfillmentText(order))}</p>
  </div>
`.trim()
}

function buildOrderGroupConfirmationHtml(orders: Order[], groupLabel: string): string {
  const blocks = orders.map(buildOrderBlockHtml).join('\n')
  const grandTotal = orders.reduce((sum, o) => sum + o.totalHuf, 0)
  const groupLine =
    orders.length > 1
      ? `<p><strong>Rendelés csoport azonosító:</strong> ${escapeHtml(groupLabel)}</p>`
      : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rendelés megerősítés</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <h1>Köszönjük a rendelésed!</h1>
  ${groupLine}
  ${orders.length > 1 ? `<p><strong>Összesen fizetve:</strong> ${formatHuf(grandTotal)}</p>` : ''}
  ${blocks}
  ${buildShippingInfoSection()}
  <p style="margin-top: 24px;"><a href="${RETURNS_URL}">Visszaküldési feltételek</a></p>
  <p>Kérdés esetén: <a href="${CONTACT_URL}">Kapcsolat</a></p>
  <p style="margin-top:24px;font-size:12px;color:#666">Ez egy rendelési (tranzakciós) értesítő, nem marketing e-mail. A hírlevélről külön tudsz leiratkozni, ha feliratkoztál.</p>
  <p>– Gulumen</p>
</body>
</html>
`.trim()
}

function buildOrderGroupConfirmationText(orders: Order[], groupLabel: string): string {
  const blocks = orders.map((order) => {
    const shipping = orderShippingHuf(order)
    const items = order.items
      .map((i) => `- ${i.name || i.productId}: ${i.qty} db × ${formatHuf(i.priceHuf)}`)
      .join('\n')
    return [
      `${orderBlockTitle(order)}`,
      `Rendelés azonosító: ${order.id}`,
      'Tételek:',
      items,
      `Részösszeg: ${formatHuf(order.subtotalHuf)}`,
      order.discountHuf > 0 ? `Kedvezmény: −${formatHuf(order.discountHuf)}` : null,
      (order.pointsDiscountHuf ?? 0) > 0
        ? `Pont kedvezmény: −${formatHuf(order.pointsDiscountHuf ?? 0)}`
        : null,
      `Szállítási díj: ${shipping === 0 ? 'Ingyenes' : formatHuf(shipping)}`,
      `Fizetendő összeg: ${formatHuf(order.totalHuf)}`,
      `Várható teljesítés: ${orderFulfillmentText(order)}`,
    ]
      .filter(Boolean)
      .join('\n')
  })

  const grandTotal = orders.reduce((sum, o) => sum + o.totalHuf, 0)
  const header = [
    'Köszönjük a rendelésed!',
    orders.length > 1 ? `Rendelés csoport: ${groupLabel}` : null,
    orders.length > 1 ? `Összesen fizetve: ${formatHuf(grandTotal)}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const shippingInfo = [
    '',
    'Szállítási információk:',
    '- Posta, GLS, Foxpost, DPD',
    `- Ingyenes szállítás ${formatHuf(FREE_SHIPPING_THRESHOLD)} felett`,
    '- Személyes átvétel nem lehetséges',
    `Részletek: ${SHIPPING_URL}`,
    '',
    `Visszaküldés: ${RETURNS_URL}`,
    `Kapcsolat: ${CONTACT_URL}`,
  ].join('\n')

  return `${header}\n\n${blocks.join('\n\n')}${shippingInfo}`
}

function sentEmailKey(groupId: string): string {
  return `${SENT_EMAIL_KEY_PREFIX}${groupId}`
}

let sentEmailsMemory = new Set<string>()
let sentEmailsLoaded = false

function loadSentEmailsFromFile(): Set<string> {
  if (sentEmailsLoaded) return sentEmailsMemory
  sentEmailsLoaded = true
  try {
    const fs = require('fs')
    const path = require('path')
    const p = path.join(process.cwd(), SENT_EMAILS_FILE)
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
      sentEmailsMemory = new Set(Array.isArray(parsed) ? parsed : [])
    }
  } catch {
    sentEmailsMemory = new Set()
  }
  return sentEmailsMemory
}

function saveSentEmailsToFile(keys: Set<string>): void {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = path.join(process.cwd(), SENT_EMAILS_FILE)
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify([...keys], null, 2), 'utf-8')
  } catch {
    // dev fallback – ha nem menthető, nem blokkoljuk az e-mailt
  }
}

async function wasConfirmationEmailSent(groupId: string): Promise<boolean> {
  const key = sentEmailKey(groupId)
  if (isDbConfigured()) {
    const row = await prisma.setting.findUnique({ where: { key } })
    return !!row
  }
  return loadSentEmailsFromFile().has(key)
}

async function markConfirmationEmailSent(groupId: string): Promise<void> {
  const key = sentEmailKey(groupId)
  if (isDbConfigured()) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })
    return
  }
  const keys = loadSentEmailsFromFile()
  keys.add(key)
  sentEmailsMemory = keys
  saveSentEmailsToFile(keys)
}

async function sendViaResend(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendOrderConfirmationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.info(
      '[order-email] RESEND_API_KEY nincs – e-mail nem küldve, csak log:',
      params.to,
      params.subject
    )
    console.info('[order-email] Plain text preview:\n', params.text)
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
      console.error('[order-email] Resend error:', err)
      return { ok: false, error: err }
    }
    console.info('[order-email] Sent confirmation to', params.to, params.subject)
    return { ok: true }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[order-email] Send failed:', err)
    return { ok: false, error: err }
  }
}

export type SendOrderConfirmationResult = { ok: true } | { ok: false; error: string }

export async function sendOrderGroupConfirmationEmail(
  orders: Order[],
  customerEmail: string | null,
  groupLabel?: string
): Promise<SendOrderConfirmationResult> {
  if (orders.length === 0) return { ok: true }

  const label = groupLabel ?? orders[0]!.orderGroupId ?? orders[0]!.id
  const html = buildOrderGroupConfirmationHtml(orders, label)
  const text = buildOrderGroupConfirmationText(orders, label)
  const subjectOrderRef = orders.length === 1 ? orders[0]!.id : label
  const subject = `Rendelés megerősítés – ${subjectOrderRef}`

  if (!customerEmail) {
    console.warn('[order-email] No customer email – skipping send. Group:', label)
    return { ok: true }
  }

  return sendViaResend({ to: customerEmail, subject, html, text })
}

/**
 * Egy rendelés megerősítő e-mailje (visszafelé kompatibilitás).
 */
export async function sendOrderConfirmationEmail(
  order: Order,
  customerEmail: string | null
): Promise<SendOrderConfirmationResult> {
  if (order.orderGroupId) {
    const groupOrders = await getOrdersByGroupId(order.orderGroupId)
    const successful = groupOrders.filter((o) => SUCCESS_STATUSES.has(o.status))
    if (successful.length > 0) {
      return sendOrderGroupConfirmationEmail(
        successful,
        customerEmail ?? order.customerEmail ?? null,
        order.orderGroupId
      )
    }
  }
  return sendOrderGroupConfirmationEmail([order], customerEmail ?? order.customerEmail ?? null)
}

/**
 * Checkout / webhook után: csak akkor küld, ha a csoport minden rendelése lezárult (nincs payment_pending),
 * és még nem ment ki megerősítő e-mail.
 */
export async function maybeSendOrderGroupConfirmationEmail(
  triggerOrderId: string,
  customerEmailOverride?: string | null
): Promise<SendOrderConfirmationResult> {
  const triggerOrder = await getOrderById(triggerOrderId)
  if (!triggerOrder) return { ok: true }

  const groupId = triggerOrder.orderGroupId ?? triggerOrder.id
  const orders = triggerOrder.orderGroupId
    ? await getOrdersByGroupId(triggerOrder.orderGroupId)
    : [triggerOrder]

  if (orders.some((o) => o.status === 'payment_pending')) {
    return { ok: true }
  }

  const successfulOrders = orders.filter((o) => SUCCESS_STATUSES.has(o.status))
  if (successfulOrders.length === 0) return { ok: true }

  if (await wasConfirmationEmailSent(groupId)) {
    return { ok: true }
  }

  const customerEmail =
    customerEmailOverride ??
    triggerOrder.customerEmail ??
    orders.find((o) => o.customerEmail)?.customerEmail ??
    null

  const result = await sendOrderGroupConfirmationEmail(
    successfulOrders,
    customerEmail,
    triggerOrder.orderGroupId ?? undefined
  )
  if (result.ok) {
    await markConfirmationEmailSent(groupId)
  }
  return result
}
