import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  needsBulkDeleteApproval,
  BULK_DELETE_APPROVAL_THRESHOLD,
  APPROVAL_STATUS,
} from './admin-approval'
import { BOOTSTRAP_ADMIN_ACTOR } from './admin-rbac'

describe('admin bulk-delete approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not require approval for owner / bootstrap regardless of count', () => {
    expect(needsBulkDeleteApproval(BOOTSTRAP_ADMIN_ACTOR, 100)).toBe(false)
    expect(
      needsBulkDeleteApproval({ id: 'o1', username: 'anna', role: 'owner' }, 50)
    ).toBe(false)
  })

  it(`requires approval for non-owner above ${BULK_DELETE_APPROVAL_THRESHOLD}`, () => {
    const catalog = { id: 'c1', username: 'bela', role: 'catalog' as const }
    expect(needsBulkDeleteApproval(catalog, BULK_DELETE_APPROVAL_THRESHOLD)).toBe(false)
    expect(needsBulkDeleteApproval(catalog, BULK_DELETE_APPROVAL_THRESHOLD + 1)).toBe(true)
  })

  it('exposes PENDING_APPROVAL status constant', () => {
    expect(APPROVAL_STATUS.PENDING).toBe('PENDING_APPROVAL')
  })
})
