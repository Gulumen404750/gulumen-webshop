import { NextResponse } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { prisma, isDbConfigured } from '@/lib/prisma'

const HISTORY_LIMIT = 20

/**
 * GET /api/gamification/history
 * Utolsó 20 PointTransaction a bejelentkezett felhasználónak.
 */
export async function GET(request: Request) {
  const limit = rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }

  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ transactions: [], mode: 'dev' as const })
  }

  try {
    const rows = await prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        type: true,
        delta: true,
        balanceAfter: true,
        reason: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        delta: row.delta,
        balanceAfter: row.balanceAfter,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[api/gamification/history] GET', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
