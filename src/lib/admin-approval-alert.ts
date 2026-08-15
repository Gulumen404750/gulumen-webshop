/**
 * Vészjelzés a főadminnak: operátor tömeges törlés/módosítás PENDING_APPROVAL.
 * ADMIN_EMAIL / RESEND hiányában csak audit + log — a művelet továbbra is felfüggesztve marad.
 */
import { sendMail } from '@/lib/mail'
import { logger } from '@/lib/logger'
import { logAdminAction } from '@/lib/admin-audit'
import { getAdminAlertEmail } from '@/lib/login-alert-email'
import { getClientIp, getUserAgent } from '@/lib/request-ip'
import type { AdminActor } from '@/lib/admin-rbac'
import { BULK_DELETE_APPROVAL_TIMEOUT_MS } from '@/lib/admin-session-constants'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PendingApprovalAlertParams = {
  approvalId: string
  kind: 'bulk_delete' | 'bulk_price'
  resource: string
  count: number
  expiresAt: Date
  actor: AdminActor
  request?: Request
}

export function buildPendingApprovalAlertEmail(params: PendingApprovalAlertParams): {
  subject: string
  html: string
  text: string
} {
  const actionLabel =
    params.kind === 'bulk_price' ? 'tömeges ármódosítás' : 'tömeges törlés'
  const minutes = Math.round(BULK_DELETE_APPROVAL_TIMEOUT_MS / 60_000)
  const subject = `[Gulumen] Sürgős: ${actionLabel} jóváhagyás (${params.count} ${params.resource})`
  const who = `${params.actor.username} (${params.actor.role})`
  const expires = params.expiresAt.toISOString()
  const ip = params.request ? getClientIp(params.request) : '–'
  const ua = params.request ? getUserAgent(params.request) || '–' : '–'

  const text = [
    `Operátor tömeges művelet függőben (${actionLabel}).`,
    `Operátor: ${who}`,
    `Erőforrás: ${params.resource}`,
    `Darabszám: ${params.count}`,
    `Approval ID: ${params.approvalId}`,
    `Lejárat: ${expires} (${minutes} perc ablak)`,
    `IP: ${ip}`,
    `UA: ${ua}`,
    '',
    'A művelet NEM futott le. Jóváhagyd vagy utasítsd el az admin dashboardon 5 percen belül.',
  ].join('\n')

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5">
  <h2 style="color:#b91c1c">Sürgős: ${escapeHtml(actionLabel)} jóváhagyás</h2>
  <p>Egy operátor <strong>${params.count}</strong> ${escapeHtml(params.resource)}
  ${escapeHtml(actionLabel)}át kérte. A művelet <strong>PENDING_APPROVAL</strong> státuszban van.</p>
  <ul>
    <li><strong>Operátor:</strong> ${escapeHtml(who)}</li>
    <li><strong>Approval ID:</strong> <code>${escapeHtml(params.approvalId)}</code></li>
    <li><strong>Lejárat:</strong> ${escapeHtml(expires)} (${minutes} perc)</li>
    <li><strong>IP:</strong> ${escapeHtml(String(ip))}</li>
  </ul>
  <p>Jelentkezz be a főadmin felületen, és 5 percen belül hagyd jóvá vagy utasítsd el.
  Lejárat után a kérelem automatikusan elutasítódik.</p>
  </body></html>`

  return { subject, html, text }
}

export async function alertPendingApproval(
  params: PendingApprovalAlertParams
): Promise<{ alerted: boolean; emailed: boolean }> {
  const to = getAdminAlertEmail()
  let emailed = false
  const mail = buildPendingApprovalAlertEmail(params)

  if (!to) {
    logger.warn(
      { approvalId: params.approvalId, kind: params.kind, count: params.count },
      'pending approval alert skipped: ADMIN_EMAIL missing'
    )
  } else {
    const sent = await sendMail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    if (!sent.ok) {
      logger.error(
        { error: sent.error, approvalId: params.approvalId },
        'pending approval alert email failed'
      )
    } else if (sent.skipped) {
      logger.warn(
        { approvalId: params.approvalId },
        'pending approval alert skipped: RESEND_API_KEY missing'
      )
    } else {
      emailed = true
    }
  }

  await logAdminAction({
    action: 'pending_approval_alert',
    success: true,
    request: params.request,
    actor: params.actor,
    details: {
      approvalId: params.approvalId,
      kind: params.kind,
      resource: params.resource,
      count: params.count,
      emailed,
    },
  })

  return { alerted: true, emailed }
}

export async function alertPendingApprovalSafe(
  params: PendingApprovalAlertParams
): Promise<void> {
  try {
    await alertPendingApproval(params)
  } catch (err) {
    logger.error({ err, approvalId: params.approvalId }, 'pending approval alert failed')
  }
}
