/**
 * Admin audit log – AdminAction tábla (sourcing success/fail, stb.).
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function logAdminAction(params: {
  action: string
  orderId?: string
  success: boolean
  details?: string
}): Promise<void> {
  if (isDbConfigured()) {
    try {
      await prisma.adminAction.create({
        data: {
          action: params.action,
          orderId: params.orderId ?? null,
          success: params.success,
          details: params.details ?? null,
        },
      })
    } catch (err) {
      logger.error({ err, ...params }, 'Admin audit log failed')
    }
  } else {
    logger.info(params, 'Admin action (no DB)')
  }
}
