/**
 * Anomália e-mail + audit. A hívó műveletet soha nem blokkolja.
 * ADMIN_EMAIL / RESEND_API_KEY hiányában csak audit + log, nincs 500.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { sendMail } from '@/lib/mail'
import { logAdminAction } from '@/lib/admin-audit'
import { logger } from '@/lib/logger'
import { getAdminAlertEmail } from '@/lib/login-alert-email'
import { getClientIp, getUserAgent } from '@/lib/request-ip'
import {
  ADMIN_BULK_DELETE_ACTIONS,
  buildAdminAnomalyHtml,
  buildAdminAnomalySubject,
  buildAdminAnomalyText,
  getAdminAnomalyThresholds,
  shouldAlertAdminAnomaly,
  type AdminAnomalyKind,
} from '@/lib/admin-anomaly'

export type AlertAdminAnomalyParams = {
  kind: AdminAnomalyKind
  count: number
  request?: Request
  details?: Record<string, unknown>
}

export async function countRecentSuccessfulAdminActions(
  actions: readonly string[],
  since: Date
): Promise<number> {
  if (!isDbConfigured() || actions.length === 0) return 0
  return prisma.adminAction.count({
    where: {
      action: { in: [...actions] },
      success: true,
      createdAt: { gte: since },
    },
  })
}

export async function alertAdminAnomaly(
  params: AlertAdminAnomalyParams
): Promise<{ alerted: boolean }> {
  const thresholds = getAdminAnomalyThresholds()
  if (!shouldAlertAdminAnomaly(params.kind, params.count, thresholds)) {
    return { alerted: false }
  }

  const to = getAdminAlertEmail()
  const ip = params.request ? getClientIp(params.request) : undefined
  const userAgent = params.request ? getUserAgent(params.request) : undefined
  let emailed = false

  if (!to) {
    logger.warn(
      { kind: params.kind, count: params.count },
      'admin anomaly alert skipped: ADMIN_EMAIL missing'
    )
  } else {
    const sent = await sendMail({
      to,
      subject: buildAdminAnomalySubject(params.kind, params.count),
      html: buildAdminAnomalyHtml({
        kind: params.kind,
        count: params.count,
        thresholds,
        ip,
        userAgent,
        details: params.details,
      }),
      text: buildAdminAnomalyText({
        kind: params.kind,
        count: params.count,
        thresholds,
        ip,
        userAgent,
      }),
    })
    if (!sent.ok) {
      logger.error({ error: sent.error, kind: params.kind }, 'admin anomaly alert email failed')
    } else if (sent.skipped) {
      logger.warn({ kind: params.kind, count: params.count }, 'admin anomaly alert skipped: RESEND_API_KEY missing')
    } else {
      emailed = true
    }
  }

  await logAdminAction({
    action: 'anomaly_alert',
    success: true,
    request: params.request,
    details: {
      kind: params.kind,
      count: params.count,
      emailed,
      ...params.details,
    },
  })

  return { alerted: true }
}

export async function alertAdminAnomalySafe(params: AlertAdminAnomalyParams): Promise<void> {
  try {
    await alertAdminAnomaly(params)
  } catch (err) {
    logger.error({ err, kind: params.kind }, 'admin anomaly alert failed')
  }
}

export async function alertBulkDeleteIfAnomalousSafe(request?: Request): Promise<void> {
  try {
    const thresholds = getAdminAnomalyThresholds()
    const since = new Date(Date.now() - thresholds.bulkDeleteWindowMs)
    const count = await countRecentSuccessfulAdminActions(ADMIN_BULK_DELETE_ACTIONS, since)
    await alertAdminAnomaly({
      kind: 'bulk_delete',
      count,
      request,
      details: {
        windowMinutes: Math.round(thresholds.bulkDeleteWindowMs / 60_000),
        actions: ADMIN_BULK_DELETE_ACTIONS.join(','),
      },
    })
  } catch (err) {
    logger.error({ err }, 'admin bulk-delete anomaly check failed')
  }
}
