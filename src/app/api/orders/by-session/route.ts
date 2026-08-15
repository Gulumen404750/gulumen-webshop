import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getOrderById, getOrdersByGroupId } from '@/lib/orders'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { toPublicOrderView } from '@/lib/order-public'

/**
 * GET /api/orders/by-session?session_id=cs_xxx
 * A siker oldal használja: session_id-ből Stripe-n keresztül orderId / orderGroupId.
 * Nyilvánosan csak összefoglaló mezők; PII + shippingEditToken csak a bejelentkezett tulajdonosnak.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing session_id' },
      { status: 400 }
    )
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    )
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const orderId = session.metadata?.orderId?.trim()
    const orderGroupId = session.metadata?.orderGroupId?.trim()

    let order = orderId ? await getOrderById(orderId) : null
    if (!order && orderGroupId) {
      const group = await getOrdersByGroupId(orderGroupId)
      order = group[0] ?? null
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found for this session' },
        { status: 404 }
      )
    }

    const sessionAuth = await getSession(request)
    const sessionUserId = sessionAuth ? await resolveSessionUserId(sessionAuth) : null
    const isOwner = Boolean(
      sessionUserId && order.userId && order.userId === sessionUserId
    )

    return NextResponse.json(toPublicOrderView(order, { isOwner }))
  } catch (err) {
    console.error('Order by session error:', err)
    return NextResponse.json(
      { error: 'Could not load order' },
      { status: 500 }
    )
  }
}
