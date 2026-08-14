/**
 * Admin audit log – AdminAction tábla.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getClientIp, getUserAgent } from '@/lib/request-ip'

export type AdminActionDetails = string | Record<string, unknown> | null | undefined

function serializeDetails(details: AdminActionDetails): string | null {
  if (details == null) return null
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details)
  } catch {
    return null
  }
}

export async function logAdminAction(params: {
  action: string
  orderId?: string
  success: boolean
  details?: AdminActionDetails
  request?: Request
  ipAddress?: string
  userAgent?: string
  actor?: { id: string; username: string; role: string } | null
}): Promise<void> {
  const ipAddress =
    params.ipAddress ?? (params.request ? getClientIp(params.request) : undefined)
  const userAgent =
    params.userAgent ?? (params.request ? getUserAgent(params.request) : undefined)
  const details = serializeDetails(params.details)
  const record = {
    action: params.action,
    orderId: params.orderId ?? null,
    success: params.success,
    details,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    actorId: params.actor?.id ?? null,
    actorUsername: params.actor?.username ?? null,
    actorRole: params.actor?.role ?? null,
  }

  if (isDbConfigured()) {
    try {
      await prisma.adminAction.create({
        data: record,
      })
    } catch (err) {
      logger.error({ err, ...record }, 'Admin audit log failed')
    }
  } else {
    logger.info(record, 'Admin action (no DB)')
  }
}
