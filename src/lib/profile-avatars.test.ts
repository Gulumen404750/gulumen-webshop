import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILE_AVATARS,
  GUEST_AVATAR_SRC,
  GULUMEN_CHAT_LOGO_SRC,
  buildProfileAvatarCatalog,
  extraAvatarId,
  isAllowedAdminAvatarUrl,
  normalizeAdminAvatarUrls,
  resolveProfileAvatar,
} from './profile-avatars'

describe('profile avatars', () => {
  it('ships a Gulumen logo path and a default catalog of local base images', () => {
    expect(GULUMEN_CHAT_LOGO_SRC).toBe('/img/logo.png')
    expect(GUEST_AVATAR_SRC).toBe('/img/avatars/guest.svg')
    expect(DEFAULT_PROFILE_AVATARS).toHaveLength(8)
    expect(DEFAULT_PROFILE_AVATARS.every((a) => a.url.startsWith('/img/avatars/seed-'))).toBe(true)
  })

  it('accepts first-party extra URLs and rejects blob/data hotlinks', () => {
    expect(isAllowedAdminAvatarUrl('/uploads/avatar.webp')).toBe(true)
    expect(isAllowedAdminAvatarUrl('https://gulumen.b-cdn.net/avatars/a.webp')).toBe(true)
    expect(isAllowedAdminAvatarUrl('blob:https://www.gulumen.com/x')).toBe(false)
    expect(isAllowedAdminAvatarUrl('data:image/png;base64,abc')).toBe(false)
    expect(isAllowedAdminAvatarUrl('https://evil.example/a.png')).toBe(false)
  })

  it('builds a catalog that can resolve a selected avatar id', () => {
    const extras = ['https://gulumen.b-cdn.net/avatars/a.webp', 'https://gulumen.b-cdn.net/avatars/a.webp']
    const catalog = buildProfileAvatarCatalog(extras)
    expect(catalog).toHaveLength(9)
    const extra = catalog.find((a) => a.source === 'admin')
    expect(extra?.id).toBe(extraAvatarId('https://gulumen.b-cdn.net/avatars/a.webp'))
    expect(resolveProfileAvatar('seed-03', catalog)?.url).toBe('/img/avatars/seed-03.svg')
    expect(resolveProfileAvatar(extra?.id, catalog)?.source).toBe('admin')
    expect(resolveProfileAvatar('missing', catalog)).toBeNull()
    expect(normalizeAdminAvatarUrls(extras)).toHaveLength(1)
  })
})
