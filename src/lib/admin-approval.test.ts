import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  needsBulkDeleteApproval,
  needsBulkMutationApproval,
  BULK_DELETE_APPROVAL_THRESHOLD,
  APPROVAL_STATUS,
  approvalTypeForPayload,
} from './admin-approval'
import { BOOTSTRAP_ADMIN_ACTOR } from './admin-rbac'

describe('admin bulk mutation approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not require approval for owner / bootstrap regardless of count', () => {
    expect(needsBulkMutationApproval(BOOTSTRAP_ADMIN_ACTOR, 100)).toBe(false)
    expect(
      needsBulkMutationApproval({ id: 'o1', username: 'anna', role: 'owner' }, 50)
    ).toBe(false)
    expect(needsBulkDeleteApproval(BOOTSTRAP_ADMIN_ACTOR, 100)).toBe(false)
  })

  it(`requires approval for non-owner above ${BULK_DELETE_APPROVAL_THRESHOLD}`, () => {
    const catalog = { id: 'c1', username: 'bela', role: 'catalog' as const }
    expect(needsBulkMutationApproval(catalog, BULK_DELETE_APPROVAL_THRESHOLD)).toBe(false)
    expect(needsBulkMutationApproval(catalog, BULK_DELETE_APPROVAL_THRESHOLD + 1)).toBe(true)
  })

  it('exposes PENDING_APPROVAL status constant', () => {
    expect(APPROVAL_STATUS.PENDING).toBe('PENDING_APPROVAL')
  })

  it('maps approval types for delete and price payloads', () => {
    expect(
      approvalTypeForPayload({
        kind: 'bulk_delete',
        resource: 'products',
        ids: ['a'],
      })
    ).toBe('bulk_delete_products')
    expect(
      approvalTypeForPayload({
        kind: 'bulk_price',
        resource: 'products',
        ids: ['a'],
        mode: 'percent',
        percentChange: -10,
      })
    ).toBe('bulk_price_products')
  })
})
