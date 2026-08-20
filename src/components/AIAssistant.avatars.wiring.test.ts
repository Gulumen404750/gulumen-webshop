import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('chat message avatars wiring', () => {
  const assistant = readFileSync(join(process.cwd(), 'src/components/AIAssistant.tsx'), 'utf-8')
  const profile = readFileSync(join(process.cwd(), 'src/app/profil/page.tsx'), 'utf-8')
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf-8')
  const adminChat = readFileSync(join(process.cwd(), 'src/app/admin/dashboard/chat/page.tsx'), 'utf-8')

  it('shows the Gulumen logo on assistant messages and the selected profile avatar on user messages', () => {
    expect(assistant).toContain("from '@/components/ChatAvatar'")
    expect(assistant).toContain('GULUMEN_CHAT_LOGO_FALLBACK_SRC')
    expect(assistant).toContain('userAvatarUrl')
    expect(assistant).toContain("t('ai.assistantAvatarAlt')")
    expect(assistant).toContain("t('ai.userAvatarAlt')")
    expect(assistant).toContain('flex-row-reverse')
    expect(hu.ai.assistantAvatarAlt).toBe('Gulumen')
  })

  it('lets the shopper pick from the admin avatar catalog on the profile page', () => {
    expect(profile).toContain('ProfileAvatarPicker')
    expect(schema).toContain('avatarId')
    expect(adminChat).toContain('ProfileAvatarSettings')
    expect(hu.profile.avatarLabel).toBe('Profilkép')
    expect(hu.profile.avatarSectionTitle).toBe('Profilképek')
    expect(existsSync(join(process.cwd(), 'public/img/avatars/seed-01.svg'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'public/img/avatars/guest.svg'))).toBe(true)
  })

  it('renders extra admin avatars as thumbnails with lightbox, not empty frames', () => {
    const settings = readFileSync(
      join(process.cwd(), 'src/app/admin/dashboard/settings/ProfileAvatarSettings.tsx'),
      'utf-8'
    )
    expect(settings).toContain('previewLayout="thumbnails"')
    expect(settings).toContain('További avatarok (feltöltés)')
  })
})
