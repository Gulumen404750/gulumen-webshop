import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { ageFromBirthDate, formatBirthDateForInput } from '@/lib/birthday-coupon'

/**
 * GET /api/admin/users?marketing=all|subscribed|unsubscribed
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermission('customers:pii')
  if (!auth.ok) return auth.response
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
      birthDate: true,
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
      birthDate: formatBirthDateForInput(u.birthDate) || null,
      age: u.birthDate ? ageFromBirthDate(u.birthDate) : null,
      marketingOptIn: u.marketingOptIn,
      marketingOptInAt: u.marketingOptInAt?.toISOString() ?? null,
      marketingOptInSource: u.marketingOptInSource,
      ordersCount: u._count.orders,
    })),
  })
}
