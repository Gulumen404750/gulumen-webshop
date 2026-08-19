import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('gift claim error locale wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('stores redeem errors as i18n keys, not translated strings', () => {
    expect(src).toMatch(/useState<LocaleNotice \| null>/)
    expect(src).toContain("setError({ key: 'giftClaim.errorRequired' })")
    expect(src).toContain("setError({ key: 'giftClaim.loginRequired' })")
    expect(src).toContain("setError({ key: 'giftClaim.errorGeneric' })")
    expect(src).toMatch(/key:\s*REDEEM_ERROR_KEYS\[String\(data\.code\)\]/)
    expect(src).not.toMatch(/setError\(t\(/)
    expect(src).toMatch(/localeNoticeText\(t, error\)/)
  })

  it('maps coupon_already_claimed to a translatable key', () => {
    expect(src).toMatch(/coupon_already_claimed:\s*'giftClaim\.errorCouponAlreadyClaimed'/)
  })
})
