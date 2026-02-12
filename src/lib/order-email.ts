/**
 * Rendelés megerősítő e-mail. Webhook (checkout.session.completed, paid) után hívjuk.
 * Élesben kösd be: Resend, SendGrid, stb. – most csak log + placeholder.
 */

import type { Order } from './orders'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
const CONTACT_URL = `${APP_URL}/kapcsolat`
const RETURNS_URL = `${APP_URL}/visszakuldes`

function buildOrderConfirmationHtml(order: Order): string {
  const itemsList = order.items
    .map(
      (i) =>
        `<li>${escapeHtml(i.name || i.productId)} – ${i.qty} db × ${i.priceHuf.toLocaleString('hu-HU')} Ft</li>`
    )
    .join('')
  const hasStock = order.items.some((i) => i.fulfillmentType === 'stock')
  const hasProcurement = order.items.some((i) => i.fulfillmentType === 'procurement')
  const fulfillment = []
  if (hasStock) fulfillment.push('Raktáron lévő termékek: feladás 24–48 órán belül.')
  if (hasProcurement) fulfillment.push('Beszerzésre rendelt termékek: várható szállítás 7–14 munkanap.')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rendelés megerősítés</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Köszönjük a rendelésed!</h1>
  <p><strong>Rendelés azonosító:</strong> ${escapeHtml(order.id)}</p>
  <p><strong>Fizetett összeg:</strong> ${order.totalHuf.toLocaleString('hu-HU')} Ft</p>
  <h2>Rendelt tételek</h2>
  <ul>${itemsList}</ul>
  <h2>Várható teljesítés</h2>
  <ul>
    ${fulfillment.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
  </ul>
  <p><a href="${RETURNS_URL}">Visszaküldési feltételek</a></p>
  <p>Kérdés esetén: <a href="${CONTACT_URL}">Kapcsolat</a></p>
  <p>– Gulumen</p>
</body>
</html>
`.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SendOrderConfirmationResult = { ok: true } | { ok: false; error: string }

/**
 * Küldi a rendelés megerősítő e-mailt. Cím: order.customerEmail ha van, különben nem küld (webhook nem kap email címet).
 * Stripe Checkout customer_email opcióval a vásárló emailje a session.customer_email vagy customer_details.email – ezt a webhook-ban átadjuk.
 */
export async function sendOrderConfirmationEmail(
  order: Order,
  customerEmail: string | null
): Promise<SendOrderConfirmationResult> {
  const html = buildOrderConfirmationHtml(order)
  const text = `Rendelés azonosító: ${order.id}\nFizetett összeg: ${order.totalHuf.toLocaleString('hu-HU')} Ft\n\nRendelt tételek:\n${order.items.map((i) => `- ${i.name || i.productId} ${i.qty} db × ${i.priceHuf} Ft`).join('\n')}\n\nVárható teljesítés: raktáron 24–48 óra, beszerzés 7–14 munkanap.\nVisszaküldés: ${RETURNS_URL}\nKapcsolat: ${CONTACT_URL}`

  if (!customerEmail) {
    console.warn('[order-email] No customer email – skipping send. Order:', order.id)
    return { ok: true }
  }

  // Élesben: Resend / SendGrid / Nodemailer stb.
  // pl. await resend.emails.send({ from: '...', to: customerEmail, subject: 'Rendelés megerősítés – ' + order.id, html })
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Gulumen <onboarding@resend.dev>',
          to: [customerEmail],
          subject: `Rendelés megerősítés – ${order.id}`,
          html,
          text,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[order-email] Resend error:', err)
        return { ok: false, error: err }
      }
      return { ok: true }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      console.error('[order-email] Send failed:', err)
      return { ok: false, error: err }
    }
  }

  console.log('[order-email] No RESEND_API_KEY – would send to', customerEmail, 'Order:', order.id)
  return { ok: true }
}
