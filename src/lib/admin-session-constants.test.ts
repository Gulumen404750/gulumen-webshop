import { describe, expect, it } from 'vitest'
import { isPublicAdminUiPath } from './admin-session-constants'

describe('isPublicAdminUiPath', () => {
  it('allows login and password-reset UI without a session', () => {
    expect(isPublicAdminUiPath('/admin/login')).toBe(true)
    expect(isPublicAdminUiPath('/admin/reset')).toBe(true)
    expect(isPublicAdminUiPath('/admin/reset/')).toBe(true)
    expect(isPublicAdminUiPath('/admin/dashboard')).toBe(false)
    expect(isPublicAdminUiPath('/admin/dashboard/settings')).toBe(false)
  })
})
