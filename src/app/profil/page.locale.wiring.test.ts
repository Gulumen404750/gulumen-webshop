import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('profile page locale-reactive notices', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/profil/page.tsx'), 'utf-8')

  it('stores login and auth errors as i18n keys and translates them at render', () => {
    expect(src).toMatch(/useState<LocaleNotice \| null>\(null\)/)
    expect(src).toContain("setLoginError({ key: 'profile.loginFailed' })")
    expect(src).toContain('{localeNoticeText(t, loginError)}')
    expect(src).toContain('{localeNoticeText(t, authError)}')
    expect(src).not.toMatch(/<p className="text-red-600 text-sm">\{loginError\}<\/p>/)
  })

  it('translates name and birth-date save errors from keys, not API Hungarian strings', () => {
    expect(src).toContain("setError({ key: 'common.saveError' })")
    expect(src).toContain("setError({ key: 'common.loadError' })")
    expect(src).toContain('{localeNoticeText(t, error)}')
    expect(src).not.toMatch(/setError\(e instanceof Error \? e\.message/)
  })
})
