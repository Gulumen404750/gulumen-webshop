/**
 * Admin session epoch (Node): jelszócsere / reset után a JWT-k érvénytelenek.
 * Redis cache: az Edge middleware is lássa a változást, ha van Upstash.
 * Redis nélkül a Node (API + dashboard layout) DB-ből ellenőriz.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { ADMIN_RECORD_ID, ADMIN_SESSION_EPOCH_REDIS_KEY } from '@/lib/admin-session-constants'

function parseEpoch(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

async function readEpochFromRedis(): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const cached = await redis.get<string | number>(ADMIN_SESSION_EPOCH_REDIS_KEY)
    return parseEpoch(cached)
  } catch (err) {
    logger.warn({ err }, 'admin session epoch redis read failed')
    return null
  }
}

async function writeEpochToRedis(epoch: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(ADMIN_SESSION_EPOCH_REDIS_KEY, String(epoch))
  } catch (err) {
    logger.warn({ err }, 'admin session epoch redis write failed')
  }
}

export async function getAdminSessionEpoch(): Promise<number> {
  const cached = await readEpochFromRedis()
  if (cached !== null) return cached
  if (!isDbConfigured()) return 0
  try {
    const row = await prisma.admin.findUnique({
      where: { id: ADMIN_RECORD_ID },
      select: { sessionEpoch: true },
    })
    const epoch = row?.sessionEpoch ?? 0
    await writeEpochToRedis(epoch)
    return epoch
  } catch (err) {
    logger.warn({ err }, 'admin session epoch db read failed')
    return 0
  }
}

export async function bumpAdminSessionEpoch(): Promise<number> {
  if (!isDbConfigured()) return 0
  const row = await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      sessionEpoch: 1,
    },
    update: {
      sessionEpoch: { increment: 1 },
    },
    select: { sessionEpoch: true },
  })
  const epoch = row.sessionEpoch
  await writeEpochToRedis(epoch)
  return epoch
}
