import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { getRedis, isRedisConfigured } from '@/lib/redis'

/**
 * GET /api/health/ready – readiness.
 * Prisma DB + (ha konfigurált) Upstash Redis elérhetőség.
 * Nem Railway liveness – átmeneti DB hiba ne indítson restart loopot.
 */
export async function GET() {
  const checks: { db: boolean | 'skipped'; redis: boolean | 'skipped' } = {
    db: 'skipped',
    redis: 'skipped',
  }
  let ready = true

  if (!isDbConfigured()) {
    checks.db = false
    ready = false
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.db = true
    } catch {
      checks.db = false
      ready = false
    }
  }

  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      if (!redis) {
        checks.redis = false
        ready = false
      } else {
        const pong = await redis.ping()
        checks.redis = pong === 'PONG' || pong === 'pong' || Boolean(pong)
        if (!checks.redis) ready = false
      }
    } catch {
      checks.redis = false
      ready = false
    }
  }

  return NextResponse.json(
    { status: ready ? 'ready' : 'not_ready', ...checks },
    { status: ready ? 200 : 503 }
  )
}
