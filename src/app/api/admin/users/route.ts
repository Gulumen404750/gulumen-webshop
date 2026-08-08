import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/users?marketing=all|subscribed|unsubscribed
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const marketing = searchParams.get('marketing') || 'all'
  const where =
    marketing === 'subscribed'
      ? { marketingOptIn: true }
      : marketing === 'unsubscribed'
        ? { marketingOptIn: false }
        : {}

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      marketingOptIn: true,
      marketingOptInAt: true,
      marketingOptInSource: true,
      _count: { select: { orders: true } },
    },
  })

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      marketingOptIn: u.marketingOptIn,
      marketingOptInAt: u.marketingOptInAt?.toISOString() ?? null,
      marketingOptInSource: u.marketingOptInSource,
      ordersCount: u._count.orders,
    })),
  })
}
