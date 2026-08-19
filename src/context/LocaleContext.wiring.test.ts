import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('LocaleContext translation reactivity', () => {
  const src = readFileSync(join(process.cwd(), 'src/context/LocaleContext.tsx'), 'utf-8')

  it('rebuilds t() from the effective locale so notices follow language changes', () => {
    expect(src).toContain('const effectiveLocale: Locale = mounted ? locale : DEFAULT_LOCALE')
    expect(src).toContain('getTranslations(effectiveLocale)')
    expect(src).toContain('useMemo<LocaleContextValue>')
    expect(src).toMatch(/locale:\s*effectiveLocale/)
  })
})
