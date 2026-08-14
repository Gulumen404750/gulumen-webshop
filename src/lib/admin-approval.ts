/**
 * Bulk törlés approval workflow (non-owner, >10 rekord).
 * Status: PENDING_APPROVAL → APPROVED | REJECTED | EXPIRED (5 perc).
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { AdminActor } from '@/lib/admin-rbac'
import {
  BULK_DELETE_APPROVAL_THRESHOLD,
  BULK_DELETE_APPROVAL_TIMEOUT_MS,
} from '@/lib/admin-session-constants'
import { logAdminAction } from '@/lib/admin-audit'

export const APPROVAL_STATUS = {
  PENDING: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const

export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS]

export type BulkDeleteResource = 'products' | 'users' | 'coupons'

export type BulkDeletePayload = {
  resource: BulkDeleteResource
  ids: string[]
}

export type PendingApprovalRow = {
  id: string
  type: string
  status: string
  payload: BulkDeletePayload
  requestedById: string | null
  requestedByUsername: string | null
  requestedByRole: string | null
  expiresAt: string
  createdAt: string
  secondsRemaining: number
}

function parsePayload(raw: unknown): BulkDeletePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const resource = obj.resource
  if (resource !== 'products' && resource !== 'users' && resource !== 'coupons') return null
  const ids = obj.ids
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && id.length > 0)) {
    return null
  }
  return { resource, ids: [...new Set(ids)] }
}

export function needsBulkDeleteApproval(actor: AdminActor, idCount: number): boolean {
  if (actor.role === 'owner' || actor.bootstrap) return false
  return idCount > BULK_DELETE_APPROVAL_THRESHOLD
}

export function approvalTypeForResource(resource: BulkDeleteResource): string {
  return `bulk_delete_${resource}`
}

async function expireIfNeeded(row: {
  id: string
  status: string
  expiresAt: Date
}): Promise<string> {
  if (row.status !== APPROVAL_STATUS.PENDING) return row.status
  if (row.expiresAt.getTime() > Date.now()) return row.status
  try {
    await prisma.adminPendingApproval.update({
      where: { id: row.id },
      data: { status: APPROVAL_STATUS.EXPIRED, resolvedAt: new Date() },
    })
  } catch (err) {
    logger.warn({ err, id: row.id }, 'failed to mark approval expired')
  }
  return APPROVAL_STATUS.EXPIRED
}

function toRow(row: {
  id: string
  type: string
  status: string
  payload: unknown
  requestedById: string | null
  requestedByUsername: string | null
  requestedByRole: string | null
  expiresAt: Date
  createdAt: Date
}): PendingApprovalRow | null {
  const payload = parsePayload(row.payload)
  if (!payload) return null
  const secondsRemaining = Math.max(
    0,
    Math.floor((row.expiresAt.getTime() - Date.now()) / 1000)
  )
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload,
    requestedById: row.requestedById,
    requestedByUsername: row.requestedByUsername,
    requestedByRole: row.requestedByRole,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    secondsRemaining,
  }
}

export async function createBulkDeleteApproval(opts: {
  actor: AdminActor
  resource: BulkDeleteResource
  ids: string[]
  request?: Request
}): Promise<PendingApprovalRow> {
  if (!isDbConfigured()) {
    throw new Error('Database not configured')
  }
  const ids = [...new Set(opts.ids.filter(Boolean))]
  const expiresAt = new Date(Date.now() + BULK_DELETE_APPROVAL_TIMEOUT_MS)
  const type = approvalTypeForResource(opts.resource)
  const payload: BulkDeletePayload = { resource: opts.resource, ids }
  const row = await prisma.adminPendingApproval.create({
    data: {
      type,
      status: APPROVAL_STATUS.PENDING,
      payload,
      requestedById: opts.actor.id,
      requestedByUsername: opts.actor.username,
      requestedByRole: opts.actor.role,
      expiresAt,
    },
  })
  await logAdminAction({
    action: 'bulk_delete_pending_approval',
    success: true,
    request: opts.request,
    actor: opts.actor,
    details: {
      approvalId: row.id,
      resource: opts.resource,
      count: ids.length,
      expiresAt: expiresAt.toISOString(),
      status: APPROVAL_STATUS.PENDING,
    },
  })
  const mapped = toRow(row)
  if (!mapped) throw new Error('invalid approval payload')
  return mapped
}

export async function listPendingApprovals(): Promise<PendingApprovalRow[]> {
  if (!isDbConfigured()) return []
  const rows = await prisma.adminPendingApproval.findMany({
    where: { status: APPROVAL_STATUS.PENDING },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const out: PendingApprovalRow[] = []
  for (const row of rows) {
    const status = await expireIfNeeded(row)
    if (status !== APPROVAL_STATUS.PENDING) continue
    const mapped = toRow({ ...row, status })
    if (mapped) out.push(mapped)
  }
  return out
}

export async function getApprovalById(id: string): Promise<PendingApprovalRow | null> {
  if (!isDbConfigured()) return null
  const row = await prisma.adminPendingApproval.findUnique({ where: { id } })
  if (!row) return null
  const status = await expireIfNeeded(row)
  return toRow({ ...row, status })
}

export type ResolveApprovalResult =
  | { ok: true; approval: PendingApprovalRow; payload: BulkDeletePayload }
  | { ok: false; code: 'not_found' | 'not_pending' | 'expired' | 'invalid_payload' }

export async function markApprovalResolved(opts: {
  id: string
  status: 'APPROVED' | 'REJECTED'
  reviewer: AdminActor
}): Promise<ResolveApprovalResult> {
  const row = await prisma.adminPendingApproval.findUnique({ where: { id: opts.id } })
  if (!row) return { ok: false, code: 'not_found' }
  const status = await expireIfNeeded(row)
  if (status === APPROVAL_STATUS.EXPIRED) return { ok: false, code: 'expired' }
  if (status !== APPROVAL_STATUS.PENDING) return { ok: false, code: 'not_pending' }
  const payload = parsePayload(row.payload)
  if (!payload) return { ok: false, code: 'invalid_payload' }

  const updated = await prisma.adminPendingApproval.update({
    where: { id: opts.id },
    data: {
      status: opts.status === 'APPROVED' ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED,
      reviewedById: opts.reviewer.id,
      reviewedByUsername: opts.reviewer.username,
      resolvedAt: new Date(),
    },
  })
  const mapped = toRow(updated)
  if (!mapped) return { ok: false, code: 'invalid_payload' }
  return { ok: true, approval: mapped, payload }
}

export { BULK_DELETE_APPROVAL_THRESHOLD, BULK_DELETE_APPROVAL_TIMEOUT_MS }
