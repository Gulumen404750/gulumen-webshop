import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('profile avatar picker accordion wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/ProfileAvatarPicker.tsx'), 'utf-8')

  it('starts collapsed and only lists avatars that have a real image', () => {
    expect(src).toContain("useState(false)")
    expect(src).toContain('aria-expanded={open}')
    expect(src).toContain("t('profile.avatarSectionTitle')")
    expect(src).toContain('hasAvatarImage')
    expect(src).toContain('brokenIds')
    expect(src).toContain('hideOnError')
    expect(src).toContain('grid grid-cols-6')
    expect(src).toContain('size={32}')
    expect(src).toContain('empty:hidden')
    expect(src).not.toContain('flex flex-wrap gap-2')
    expect(hu.profile.avatarSectionTitle).toBe('Profilképek')
  })
})
