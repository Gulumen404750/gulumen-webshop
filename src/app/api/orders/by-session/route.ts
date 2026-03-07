import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getOrderById } from '@/lib/orders'

/**
 * GET /api/orders/by-session?session_id=cs_xxx
 * A siker oldal használja: session_id-ből Stripe-n keresztül orderId, majd rendelés.
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
    const orderId = session.metadata?.orderId
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order not found for this session' },
        { status: 404 }
      )
    }
    const order = await getOrderById(orderId)
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(order)
  } catch (err) {
    console.error('Order by session error:', err)
    return NextResponse.json(
      { error: 'Could not load order' },
      { status: 500 }
    )
  }
}
