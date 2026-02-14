import { NextResponse } from 'next/server'
import { getOrderById, setOrderStatus } from '@/lib/orders'
import { getPaymentTransactionsByOrderId, updatePaymentTransactionStatus } from '@/lib/payment-transactions'
import { getPaymentProvider } from '@/lib/payment-provider'

/**
 * POST /api/admin/sourcing/:orderId/success
 * Sourcing rendelés sikeres beszerzés: capture a zárolt összeg, order → paid vagy fulfilled.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  console.debug('[admin/sourcing/success]', orderId)

  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    console.error('[admin/sourcing/success] ADMIN_API_KEY not configured')
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }
  const key = _request.headers.get('x-admin-key')
  if (key !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const order = getOrderById(orderId)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'sourcing') {
    return NextResponse.json(
      { error: 'Order is not a sourcing order' },
      { status: 400 }
    )
  }
  if (order.status === 'sourcing_failed' || order.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Order already cancelled or failed' },
      { status: 400 }
    )
  }

  const transactions = getPaymentTransactionsByOrderId(orderId)
  const authTx = transactions.find((t) => t.mode === 'authorize' && t.status !== 'cancelled' && t.status !== 'failed')
  if (!authTx) {
    return NextResponse.json(
      { error: 'No authorization transaction found for this order' },
      { status: 400 }
    )
  }

  const provider = getPaymentProvider()
  const result = await provider.captureAuthorizedPayment({
    transactionId: authTx.id,
  })

  if (!result.success) {
    console.error('[admin/sourcing/success] capture failed', result.error)
    return NextResponse.json(
      { error: result.error || 'Capture failed' },
      { status: 500 }
    )
  }

  updatePaymentTransactionStatus(authTx.id, 'succeeded')
  setOrderStatus(orderId, 'fulfilled')

  console.debug('[admin/sourcing/success] order fulfilled', orderId)
  return NextResponse.json({ success: true, orderId, status: 'fulfilled' })
}
