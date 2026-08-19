import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('GiftPointClaimForm', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('keeps the redeem box title short and moves rules behind a help control', () => {
    expect(hu.giftClaim.title).toBe('Kupon')
    expect(src).toMatch(/giftClaim\.title/)
    expect(src).toMatch(/CircleHelp/)
    expect(src).toMatch(/giftClaim\.helpAria/)
    expect(src).toMatch(/giftClaim\.hint/)
    expect(src).not.toMatch(/<p className="text-sm text-muted mt-1">\{t\('giftClaim\.hint'/)
  })
})
