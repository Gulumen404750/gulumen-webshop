/**
 * Rendelés megerősítő e-mail (Resend).
 * Csak sikeres fizetés után hívjuk (Stripe webhook: payment_status === 'paid' /
 * authorize requires_capture|succeeded; Dummy/points checkout után).
 * Ha nincs RESEND_API_KEY, csak logol – nem dob hibát.
 */

import type { Order } from './orders'
import { getOrderById, getOrdersByGroupId } from './orders'
import { prisma, isDbConfigured } from './prisma'
import { FREE_SHIPPING_THRESHOLD } from './checkout'
import { sendMail } from './mail'
import {
  getSupportInboxEmail,
  warnIfSupportInboxUnreliable,
} from './support-email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
const CONTACT_URL = `${APP_URL}/kapcsolat`
const RETURNS_URL = `${APP_URL}/visszakuldes`
const SHIPPING_URL = `${APP_URL}/szallitas`

/** Ügyfélszolgálat – módosítási kérésekhez (válasz / mailto). Futásidőben feloldva. */
export function getOrderSupportEmail(): string {
  const email = getSupportInboxEmail()
  warnIfSupportInboxUnreliable(email, 'order confirmation Reply-To')
  return email
}

/** Futásidőben feloldott support cím – tesztekhez / kompatibilitáshoz. */
export { getOrderSupportEmail as ORDER_SUPPORT_EMAIL_FN }

const SENT_EMAIL_KEY_PREFIX = 'order_confirmation_sent:'
const SENT_EMAILS_FILE = 'data/sent-order-emails.json'

/** Sikeres fizetés utáni státuszok, amelyekre megerősítő e-mail mehet. */
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

function formatAddressLines(params: {
  name?: string
  phone?: string
  postalCode?: string
  city?: string
  street?: string
  houseNumber?: string
}): string[] {
  const lines: string[] = []
  if (params.name?.trim()) lines.push(params.name.trim())
  const streetParts = [params.street, params.houseNumber].filter((p) => p?.trim()).join(' ').trim()
  if (streetParts) lines.push(streetParts)
  const cityLine = [params.postalCode, params.city].filter((p) => p?.trim()).join(' ').trim()
  if (cityLine) lines.push(cityLine)
  if (params.phone?.trim()) lines.push(`Tel: ${params.phone.trim()}`)
  return lines
}

function hasShippingAddress(order: Order): boolean {
  return !!(
    order.shippingStreet ||
    order.shippingCity ||
    order.shippingPostalCode ||
    order.shippingHouseNumber
  )
}

function hasBillingAddress(order: Order): boolean {
  return !!(
    order.billingStreet ||
    order.billingCity ||
    order.billingPostalCode ||
    order.billingHouseNumber
  )
}

/** Címek + ügyféladatok egy rendelésből (csoportnál az első teljes című rendelést használjuk). */
export function pickCustomerAddressOrder(orders: Order[]): Order {
  return (
    orders.find((o) => hasShippingAddress(o) || hasBillingAddress(o) || o.customerName) ??
    orders[0]!
  )
}

export function buildOrderChangeMailto(orderRef: string): string {
  const support = getOrderSupportEmail()
  const subject = encodeURIComponent(`Rendelés módosítás – ${orderRef}`)
  const body = encodeURIComponent(
    `Kedves Gulumen!\n\nA(z) ${orderRef} azonosítójú rendelésem adatain szeretnék módosítani, mielőtt elkezdenék csomagolni.\n\nKért módosítás:\n`
  )
  return `mailto:${support}?subject=${subject}&body=${body}`
}

function buildCustomerDetailsSection(order: Order, orderRef: string): string {
  const shippingLines = formatAddressLines({
    name: order.customerName,
    phone: order.customerPhone,
    postalCode: order.shippingPostalCode,
    city: order.shippingCity,
    street: order.shippingStreet,
    houseNumber: order.shippingHouseNumber,
  })

  const billingSame = order.billingSameAsShipping !== false && !hasBillingAddress(order)
  const billingLines = billingSame
    ? []
    : formatAddressLines({
        name: order.customerName,
        postalCode: order.billingPostalCode,
        city: order.billingCity,
        street: order.billingStreet,
        houseNumber: order.billingHouseNumber,
      })

  const shippingHtml =
    shippingLines.length > 0
      ? shippingLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')
      : '<li>Nincs megadva</li>'

  const billingHtml = billingSame
    ? '<li>Megegyezik a szállítási címmel</li>'
    : billingLines.length > 0
      ? billingLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')
      : '<li>Nincs megadva</li>'

  const notes =
    order.deliveryNotes?.trim()
      ? `<p><strong>Szállítási megjegyzés:</strong> ${escapeHtml(order.deliveryNotes.trim())}</p>`
      : ''

  const mailto = buildOrderChangeMailto(orderRef)
  const support = getOrderSupportEmail()

  return `
  <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <h2 style="margin-top: 0; color: #92400e;">Kérjük, ellenőrizd az adataidat!</h2>
    <p style="color: #78350f;">
      A csomagolás megkezdése előtt ellenőrizd a szállítási és számlázási adatokat.
      Ha valamit módosítani szeretnél, jelezd nekünk mielőbb — amíg nem kezdjük el a csomagolást, tudunk segíteni.
    </p>
    <p>
      <a href="${mailto}" style="display: inline-block; background: #92400e; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 600;">
        Módosítás jelzése e-mailben
      </a>
    </p>
    <p style="font-size: 14px; color: #78350f;">
      Vagy írj a <a href="${mailto}">${escapeHtml(support)}</a> címre,
      illetve használd a <a href="${CONTACT_URL}">kapcsolati űrlapot</a>.
    </p>
    <h3>Szállítási cím</h3>
    <ul style="list-style: none; padding-left: 0;">${shippingHtml}</ul>
    <h3>Számlázási cím</h3>
    <ul style="list-style: none; padding-left: 0;">${billingHtml}</ul>
    ${notes}
  </div>
`.trim()
}

function buildCustomerDetailsText(order: Order, orderRef: string): string {
  const support = getOrderSupportEmail()
  const shippingLines = formatAddressLines({
    name: order.customerName,
    phone: order.customerPhone,
    postalCode: order.shippingPostalCode,
    city: order.shippingCity,
    street: order.shippingStreet,
    houseNumber: order.shippingHouseNumber,
  })
  const billingSame = order.billingSameAsShipping !== false && !hasBillingAddress(order)
  const billingLines = billingSame
    ? ['Megegyezik a szállítási címmel']
    : formatAddressLines({
        name: order.customerName,
        postalCode: order.billingPostalCode,
        city: order.billingCity,
        street: order.billingStreet,
        houseNumber: order.billingHouseNumber,
      })

  return [
    '',
    '---',
    'Kérjük, ellenőrizd az adataidat!',
    'A csomagolás megkezdése előtt ellenőrizd a szállítási és számlázási adatokat.',
    'Ha módosításra van szükség, jelezd mielőbb — amíg nem kezdjük el a csomagolást, tudunk segíteni.',
    `Módosítás jelzése: ${support} (válaszolj erre az e-mailre, vagy nyisd meg: ${buildOrderChangeMailto(orderRef)})`,
    `Kapcsolat: ${CONTACT_URL}`,
    '',
    'Szállítási cím:',
    ...(shippingLines.length > 0 ? shippingLines.map((l) => `- ${l}`) : ['- Nincs megadva']),
    '',
    'Számlázási cím:',
    ...(billingLines.length > 0 ? billingLines.map((l) => `- ${l}`) : ['- Nincs megadva']),
    order.deliveryNotes?.trim() ? `\nSzállítási megjegyzés: ${order.deliveryNotes.trim()}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n')
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
    <p><strong>Rendelésszám:</strong> ${escapeHtml(order.id)}</p>
    <h3>Rendelt tételek</h3>
    <ul>${itemsList}</ul>
    <ul style="list-style: none; padding-left: 0;">
      <li>Részösszeg: ${formatHuf(order.subtotalHuf)}</li>
      ${discountParts.join('\n      ')}
      <li>Szállítási díj: ${shipping === 0 ? 'Ingyenes' : formatHuf(shipping)}</li>
      <li><strong>Végösszeg:</strong> ${formatHuf(order.totalHuf)}</li>
    </ul>
    <p><strong>Várható teljesítés:</strong> ${escapeHtml(orderFulfillmentText(order))}</p>
  </div>
`.trim()
}

/** HTML sablon – tesztekhez exportálva. */
export function buildOrderGroupConfirmationHtml(orders: Order[], groupLabel: string): string {
  const blocks = orders.map(buildOrderBlockHtml).join('\n')
  const grandTotal = orders.reduce((sum, o) => sum + o.totalHuf, 0)
  const groupLine =
    orders.length > 1
      ? `<p><strong>Rendelés csoport azonosító:</strong> ${escapeHtml(groupLabel)}</p>`
      : ''
  const addressOrder = pickCustomerAddressOrder(orders)
  const orderRef = orders.length === 1 ? orders[0]!.id : groupLabel

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rendelés megerősítés</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <h1>Köszönjük a rendelésed!</h1>
  <p>A fizetés sikeresen megtörtént. Az alábbiakban a rendelésed részletei találhatók.</p>
  ${groupLine}
  ${orders.length > 1 ? `<p><strong>Összesen fizetve:</strong> ${formatHuf(grandTotal)}</p>` : ''}
  ${blocks}
  ${buildCustomerDetailsSection(addressOrder, orderRef)}
  ${buildShippingInfoSection()}
  <p style="margin-top: 24px;"><a href="${RETURNS_URL}">Visszaküldési feltételek</a></p>
  <p>Kérdés esetén: <a href="${CONTACT_URL}">Kapcsolat</a></p>
  <p style="margin-top:24px;font-size:12px;color:#666">Ez egy rendelési (tranzakciós) értesítő, nem marketing e-mail. A hírlevélről külön tudsz leiratkozni, ha feliratkoztál.</p>
  <p>– Gulumen</p>
</body>
</html>
`.trim()
}

/** Plain text sablon – tesztekhez exportálva. */
export function buildOrderGroupConfirmationText(orders: Order[], groupLabel: string): string {
  const blocks = orders.map((order) => {
    const shipping = orderShippingHuf(order)
    const items = order.items
      .map((i) => `- ${i.name || i.productId}: ${i.qty} db × ${formatHuf(i.priceHuf)}`)
      .join('\n')
    return [
      `${orderBlockTitle(order)}`,
      `Rendelésszám: ${order.id}`,
      'Tételek:',
      items,
      `Részösszeg: ${formatHuf(order.subtotalHuf)}`,
      order.discountHuf > 0 ? `Kedvezmény: −${formatHuf(order.discountHuf)}` : null,
      (order.pointsDiscountHuf ?? 0) > 0
        ? `Pont kedvezmény: −${formatHuf(order.pointsDiscountHuf ?? 0)}`
        : null,
      `Szállítási díj: ${shipping === 0 ? 'Ingyenes' : formatHuf(shipping)}`,
      `Végösszeg: ${formatHuf(order.totalHuf)}`,
      `Várható teljesítés: ${orderFulfillmentText(order)}`,
    ]
      .filter(Boolean)
      .join('\n')
  })

  const grandTotal = orders.reduce((sum, o) => sum + o.totalHuf, 0)
  const header = [
    'Köszönjük a rendelésed!',
    'A fizetés sikeresen megtörtént. Az alábbiakban a rendelésed részletei találhatók.',
    orders.length > 1 ? `Rendelés csoport: ${groupLabel}` : null,
    orders.length > 1 ? `Összesen fizetve: ${formatHuf(grandTotal)}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const addressOrder = pickCustomerAddressOrder(orders)
  const orderRef = orders.length === 1 ? orders[0]!.id : groupLabel
  const customerDetails = buildCustomerDetailsText(addressOrder, orderRef)

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

  return `${header}\n\n${blocks.join('\n\n')}${customerDetails}${shippingInfo}`
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
  replyTo?: string
}): Promise<SendOrderConfirmationResult> {
  const result = await sendMail(params)
  if (!result.ok) return { ok: false, error: result.error }
  if (result.skipped) {
    return { ok: true, skipped: true, error: 'RESEND_API_KEY hiányzik – e-mail nem ment ki' }
  }
  return { ok: true, sent: true, id: result.id }
}

export type SendOrderConfirmationResult =
  | { ok: true; sent?: boolean; skipped?: boolean; id?: string; error?: string }
  | { ok: false; error: string }

/** Admin / postmaster másolat sikeres fizetésről. */
async function sendAdminPaidNotification(
  orders: Order[],
  customerEmail: string,
  groupLabel: string
): Promise<void> {
  const adminTo = getOrderSupportEmail()
  if (!adminTo || adminTo.toLowerCase() === customerEmail.toLowerCase()) return

  const subjectRef = orders.length === 1 ? orders[0]!.id : groupLabel
  const total = orders.reduce((sum, o) => sum + o.totalHuf, 0)
  const addressOrder = pickCustomerAddressOrder(orders)
  const ship = [
    addressOrder.customerName,
    [addressOrder.shippingStreet, addressOrder.shippingHouseNumber].filter(Boolean).join(' '),
    [addressOrder.shippingPostalCode, addressOrder.shippingCity].filter(Boolean).join(' '),
    addressOrder.customerPhone ? `Tel: ${addressOrder.customerPhone}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const items = orders
    .flatMap((o) => o.items.map((i) => `- ${i.name || i.productId}: ${i.qty} db`))
    .join('\n')

  const text = [
    'Új sikeres rendelés',
    `Rendelés: ${subjectRef}`,
    `Vásárló: ${customerEmail}`,
    `Összeg: ${total.toLocaleString('hu-HU')} Ft`,
    `Szállítás: ${ship || '–'}`,
    '',
    'Tételek:',
    items,
  ].join('\n')

  const result = await sendMail({
    to: adminTo,
    subject: `[Gulumen] Új rendelés – ${subjectRef}`,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    text,
    replyTo: customerEmail,
  })
  if (!result.ok) {
    console.error('[order-email] Admin paid notification failed:', result.error)
  } else if (result.skipped) {
    console.warn('[order-email] Admin paid notification skipped (no RESEND_API_KEY)')
  } else {
    console.info('[order-email] Admin paid notification sent to', adminTo, result.id ?? '')
  }
}

export async function sendOrderGroupConfirmationEmail(
  orders: Order[],
  customerEmail: string | null,
  groupLabel?: string
): Promise<SendOrderConfirmationResult> {
  if (orders.length === 0) return { ok: true, skipped: true }

  const label = groupLabel ?? orders[0]!.orderGroupId ?? orders[0]!.id
  const html = buildOrderGroupConfirmationHtml(orders, label)
  const text = buildOrderGroupConfirmationText(orders, label)
  const subjectOrderRef = orders.length === 1 ? orders[0]!.id : label
  const subject = `Rendelés megerősítés – ${subjectOrderRef}`
  const replyTo = getOrderSupportEmail()

  if (!customerEmail) {
    console.warn('[order-email] No customer email – not marking sent. Group:', label)
    return { ok: false, error: 'Nincs vásárlói e-mail a visszaigazoláshoz' }
  }

  console.info('[order-email] Sending confirmation', {
    to: customerEmail,
    replyTo,
    subject,
    orderIds: orders.map((o) => o.id),
  })

  const result = await sendViaResend({
    to: customerEmail,
    subject,
    html,
    text,
    replyTo,
  })

  if (result.ok && result.sent) {
    // Másolat a postmaster / support inboxnak (nem a vásárlónak).
    try {
      await sendAdminPaidNotification(orders, customerEmail, label)
    } catch (err) {
      console.error('[order-email] Admin notification error (customer mail already sent):', err)
    }
  }

  return result
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
 * legalább egy sikeres (paid / sourcing_pending / fulfilled), és még nem ment ki megerősítő e-mail.
 *
 * A Stripe webhook útvonalak csak payment_status === 'paid' (capture) vagy érvényes authorize
 * után hívják — tehát a fizetés 100%-ig sikeres, mielőtt ideérünk.
 */
export async function maybeSendOrderGroupConfirmationEmail(
  triggerOrderId: string,
  customerEmailOverride?: string | null
): Promise<SendOrderConfirmationResult> {
  const triggerOrder = await getOrderById(triggerOrderId)
  if (!triggerOrder) return { ok: true }

  // Csak sikeres fizetés utáni státuszból indítható a küldés (webhook / checkout már átállította).
  if (!SUCCESS_STATUSES.has(triggerOrder.status)) {
    console.debug(
      '[order-email] Skip confirmation – trigger order not in success status:',
      triggerOrder.id,
      triggerOrder.status
    )
    return { ok: true }
  }

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
  // Csak tényleges sikeres küldés után jelöljük elküldöttnek (skipped/fail → újrapróbálható).
  if (result.ok && result.sent) {
    await markConfirmationEmailSent(groupId)
  } else if (!result.ok) {
    console.error('[order-email] Confirmation not sent – will retry on next webhook/checkout:', result.error)
  } else if (result.skipped) {
    console.warn('[order-email] Confirmation skipped (Resend not configured) – not marking sent')
  }
  return result
}
