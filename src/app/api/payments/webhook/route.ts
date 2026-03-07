import { NextResponse } from 'next/server'
import { getPaymentTransactionById, updatePaymentTransactionStatus } from '@/lib/payment-transactions'
import { getOrderById, setOrderStatus } from '@/lib/orders'
import { markReservationsPaidByOrderId, markReservationsCanceledByOrderId } from '@/lib/reservations'
import type { PaymentTransactionStatus } from '@/lib/payment-transactions'

/**
 * Provider-független payment webhook váz.
 * A provider (Stripe, Barion, Dummy) visszajelzése itt frissíti a tranzakció és rendelés státuszt.
 * Biztonság: kötelező PAYMENTS_WEBHOOK_SECRET env, és X-Webhook-Secret header egyezik.
 *
 * Body (általános): { provider, transactionId, status, providerRef? }
 * status: succeeded | failed | cancelled | pending
 */
const MAX_BODY_SIZE = 4 * 1024

const webhookBodySchema = {
  parse(body: unknown): { provider: string; transactionId: string; status: string; providerRef?: string } | null {
    if (!body || typeof body !== 'object') return null
    const o = body as Record<string, unknown>
    const provider = typeof o.provider === 'string' ? o.provider : null
    const transactionId = typeof o.transactionId === 'string' ? o.transactionId : null
    const status = typeof o.status === 'string' ? o.status : null
    const providerRef = typeof o.providerRef === 'string' ? o.providerRef : undefined
    if (!provider || !transactionId || !status) return null
    return { provider, transactionId, status, providerRef }
  },
}

export async function POST(request: Request) {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[payments/webhook] PAYMENTS_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const provided = request.headers.get('x-webhook-secret')
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: unknown
    try {
      const raw = await request.text()
      if (raw.length > MAX_BODY_SIZE) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 })
      }
      body = JSON.parse(raw)
    } catch {
      console.debug('[payments/webhook] Invalid JSON')
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const parsed = webhookBodySchema.parse(body)
    if (!parsed) {
      console.debug('[payments/webhook] Missing provider, transactionId or status')
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const { transactionId, status, providerRef } = parsed

    const tx = getPaymentTransactionById(transactionId)
    if (!tx) {
      console.debug('[payments/webhook] Transaction not found', transactionId)
      return NextResponse.json({ received: true })
    }

    const newTxStatus: PaymentTransactionStatus =
      status === 'succeeded'
        ? 'succeeded'
        : status === 'failed' || status === 'cancelled'
          ? status
          : 'pending'

    updatePaymentTransactionStatus(transactionId, newTxStatus, providerRef)

    const order = await getOrderById(tx.orderId)
    if (!order) {
      console.debug('[payments/webhook] Order not found for tx', tx.orderId)
      return NextResponse.json({ received: true })
    }

    if (newTxStatus === 'succeeded') {
      if (tx.mode === 'capture') {
        await setOrderStatus(order.id, 'paid')
        console.debug('[payments/webhook] Order marked paid (capture)', order.id)
      } else {
        await setOrderStatus(order.id, 'sourcing_pending')
        console.debug('[payments/webhook] Order marked sourcing_pending (authorize)', order.id)
      }
      await markReservationsPaidByOrderId(order.id)
    } else if (newTxStatus === 'failed' || newTxStatus === 'cancelled') {
      if (tx.mode === 'authorize') {
        await markReservationsCanceledByOrderId(order.id)
      }
      await setOrderStatus(order.id, 'cancelled')
      console.debug('[payments/webhook] Order marked cancelled', order.id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[payments/webhook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
