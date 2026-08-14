import { describe, expect, it } from 'vitest'
import { shouldParkAdminSession } from './admin-session-park'
import { BOOTSTRAP_ADMIN_ACTOR } from './admin-rbac'

describe('shouldParkAdminSession', () => {
  it('parks owner when switching to support', () => {
    expect(
      shouldParkAdminSession(
        { id: 'owner-1', username: 'te', role: 'owner' },
        { id: 'op-2', username: 'kata', role: 'support' }
      )
    ).toBe(true)
  })

  it('parks bootstrap when switching to named operator', () => {
    expect(
      shouldParkAdminSession(BOOTSTRAP_ADMIN_ACTOR, {
        id: 'op-2',
        username: 'kata',
        role: 'support',
      })
    ).toBe(true)
  })

  it('does not park when same actor', () => {
    const actor = { id: 'owner-1', username: 'te', role: 'owner' as const }
    expect(shouldParkAdminSession(actor, actor)).toBe(false)
  })

  it('does not park support over owner (nothing to restore as owner)', () => {
    expect(
      shouldParkAdminSession(
        { id: 'op-2', username: 'kata', role: 'support' },
        { id: 'owner-1', username: 'te', role: 'owner' }
      )
    ).toBe(false)
  })
})
