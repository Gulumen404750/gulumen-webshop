import { NextResponse } from 'next/server'
import { getOrderById, setOrderStatus } from '@/lib/orders'
import { getPaymentTransactionsByOrderId, updatePaymentTransactionStatus } from '@/lib/payment-transactions'
import { getPaymentProvider } from '@/lib/payment-provider'
import { logAdminAction } from '@/lib/admin-audit'
import { logger } from '@/lib/logger'
import { markReservationsCanceledByOrderId } from '@/lib/reservations'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/sourcing/:orderId/fail
 * Sourcing rendelés sikertelen: cancel a zárolt összeg, order → sourcing_failed.
 * Auth: admin cookie vagy x-admin-key header.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  logger.debug({ orderId }, 'admin/sourcing/fail')

  const adminKey = process.env.ADMIN_API_KEY
  const cookieAuth = await requireAdmin()
  const keyAuth = adminKey && request.headers.get('x-admin-key') === adminKey
  if (!cookieAuth && !keyAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!adminKey && !cookieAuth) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'sourcing') {
    return NextResponse.json(
      { error: 'Order is not a sourcing order' },
      { status: 400 }
    )
  }
  if (order.status === 'sourcing_failed') {
    return NextResponse.json({ success: true, orderId, status: 'sourcing_failed' })
  }
  if (order.status === 'fulfilled' || order.status === 'paid') {
    return NextResponse.json(
      { error: 'Order already captured' },
      { status: 400 }
    )
  }

  const transactions = await getPaymentTransactionsByOrderId(orderId)
  const authTx = transactions.find((t) => t.mode === 'authorize' && t.status !== 'cancelled' && t.status !== 'failed')
  if (!authTx) {
    return NextResponse.json(
      { error: 'No authorization transaction found for this order' },
      { status: 400 }
    )
  }

  const provider = getPaymentProvider()
  const result = await provider.cancelAuthorizedPayment({
    transactionId: authTx.id,
  })

  if (!result.success) {
    logger.error({ orderId, error: result.error }, 'admin/sourcing/fail cancel failed')
    await logAdminAction({ action: 'sourcing_fail', orderId, success: false, details: result.error })
    return NextResponse.json(
      { error: result.error || 'Cancel failed' },
      { status: 500 }
    )
  }

  await updatePaymentTransactionStatus(authTx.id, 'cancelled')
  await markReservationsCanceledByOrderId(orderId)
  await setOrderStatus(orderId, 'sourcing_failed')
  await logAdminAction({ action: 'sourcing_fail', orderId, success: true })

  logger.debug({ orderId }, 'admin/sourcing/fail order sourcing_failed')
  return NextResponse.json({ success: true, orderId, status: 'sourcing_failed' })
}
