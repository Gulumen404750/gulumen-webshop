import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('ThemeChooser wiring', () => {
  it('is mounted from the root layout inside ThemeProvider', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf-8')
    expect(layout).toMatch(/from ['"]@\/context\/ThemeContext['"]/)
    expect(layout).toMatch(/from ['"]@\/components\/ThemeChooser['"]/)
    expect(layout).toMatch(/<ThemeProvider>/)
    expect(layout).toMatch(/<ThemeChooser\s*\/>/)
    expect(layout).toMatch(/THEME_BOOTSTRAP_SCRIPT/)
    expect(layout).toMatch(/nonce=\{nonce\}/)
    expect(layout).toMatch(/CSP_NONCE_HEADER/)
  })

  it('persists the first choice and skips returning visitors', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/ThemeChooser.tsx'), 'utf-8')
    expect(src).toMatch(/hasChosen/)
    expect(src).toMatch(/setPreference/)
    expect(src).toMatch(/themeChooser\.title/)
    expect(src).not.toMatch(/aria-label=\{t\('buttons\.close'\)\}/)
  })
})
