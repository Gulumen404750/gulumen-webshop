/**
 * Admin audit log – AdminAction tábla (ki / mit / mikor).
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getClientIp, getUserAgent } from '@/lib/request-ip'
import type { AdminActor } from '@/lib/admin-rbac'

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

async function resolveActor(explicit: AdminActor | null | undefined): Promise<AdminActor | null> {
  if (explicit !== undefined) return explicit
  try {
    const { getAdminActor } = await import('@/lib/admin-auth')
    return await getAdminActor()
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
  actor?: AdminActor | null
}): Promise<void> {
  const ipAddress =
    params.ipAddress ?? (params.request ? getClientIp(params.request) : undefined)
  const userAgent =
    params.userAgent ?? (params.request ? getUserAgent(params.request) : undefined)
  const details = serializeDetails(params.details)
  const actor = await resolveActor(params.actor)
  const record = {
    action: params.action,
    orderId: params.orderId ?? null,
    success: params.success,
    details,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    actorId: actor?.id ?? null,
    actorUsername: actor?.username ?? null,
    actorRole: actor?.role ?? null,
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
