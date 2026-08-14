/**
 * Admin JWT denylist (logout után a jti érvénytelen).
 * Edge-kompatibilis: Upstash Redis, egyébként process-szintű memória.
 */

import { ADMIN_SESSION_MAX_AGE_SEC } from '@/lib/admin-session-constants'
import { getRedis, isRedisConfigured } from '@/lib/redis'

const memoryRevoked = new Map<string, number>()
const REDIS_PREFIX = 'admin:revoked:'

function pruneMemory(now = Date.now()): void {
  for (const [jti, exp] of memoryRevoked) {
    if (exp <= now) memoryRevoked.delete(jti)
  }
}

export async function revokeAdminSessionJti(
  jti: string,
  ttlSec = ADMIN_SESSION_MAX_AGE_SEC
): Promise<void> {
  if (!jti) return
  const expiresAt = Date.now() + ttlSec * 1000
  memoryRevoked.set(jti, expiresAt)
  if (!isRedisConfigured()) return
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(`${REDIS_PREFIX}${jti}`, '1', { ex: ttlSec })
  } catch {
    /* memória már tárolja */
  }
}

export async function isAdminSessionRevoked(jti: string): Promise<boolean> {
  if (!jti) return true
  pruneMemory()
  const memExp = memoryRevoked.get(jti)
  if (memExp && memExp > Date.now()) return true
  if (!isRedisConfigured()) return false
  const redis = getRedis()
  if (!redis) return false
  try {
    const value = await redis.get<string>(`${REDIS_PREFIX}${jti}`)
    return value === '1' || value === 'true'
  } catch {
    return false
  }
}

export function resetAdminSessionRevokeForTests(): void {
  memoryRevoked.clear()
}
