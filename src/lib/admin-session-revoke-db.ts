/**
 * Tartós JWT denylist (Prisma) – csak Node API / logout.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_SESSION_MAX_AGE_SEC } from '@/lib/admin-session-constants'
import { logger } from '@/lib/logger'

export async function persistRevokedAdminJti(
  jti: string,
  ttlSec = ADMIN_SESSION_MAX_AGE_SEC
): Promise<void> {
  if (!jti || !isDbConfigured()) return
  const expiresAt = new Date(Date.now() + ttlSec * 1000)
  try {
    await prisma.adminRevokedSession.upsert({
      where: { jti },
      create: { jti, expiresAt },
      update: { expiresAt },
    })
  } catch (err) {
    logger.error({ err, jti }, 'admin session revoke persist failed')
  }
}

export async function dbIsAdminSessionRevoked(jti: string): Promise<boolean> {
  if (!jti || !isDbConfigured()) return false
  try {
    const row = await prisma.adminRevokedSession.findUnique({
      where: { jti },
      select: { expiresAt: true },
    })
    if (!row) return false
    return row.expiresAt.getTime() > Date.now()
  } catch (err) {
    logger.error({ err, jti }, 'admin session revoke lookup failed')
    return false
  }
}
