import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getTranslations, t } from '@/i18n/translations'
import { localeNoticeText } from '@/lib/locale-notice'

describe('gift claim error locale wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/GiftPointClaimForm.tsx'), 'utf-8')

  it('stores redeem errors as i18n keys, not translated strings', () => {
    expect(src).toMatch(/useState<LocaleNotice \| null>/)
    expect(src).toContain("setError({ key: 'giftClaim.errorRequired' })")
    expect(src).toContain("setError({ key: 'giftClaim.loginRequired' })")
    expect(src).toContain("setError({ key: 'giftClaim.errorGeneric' })")
    expect(src).toMatch(/REDEEM_ERROR_KEYS\[code\]/)
    expect(src).toContain("typeof data.code === 'string'")
    expect(src).not.toMatch(/setError\(t\(/)
    expect(src).not.toMatch(/data\.error/)
    expect(src).toMatch(/localeNoticeText\(t, error\)/)
  })

  it('maps coupon_already_claimed to a translatable key', () => {
    expect(src).toMatch(/coupon_already_claimed:\s*'giftClaim\.errorCouponAlreadyClaimed'/)
  })

  it('translates the already-claimed coupon notice per locale without resubmit', () => {
    const notice = { key: 'giftClaim.errorCouponAlreadyClaimed' }
    const hu = localeNoticeText((key) => t(getTranslations('hu'), key), notice)
    const en = localeNoticeText((key) => t(getTranslations('en'), key), notice)
    expect(hu).toBe('Ez a kupon már aktiválva van a fiókodon.')
    expect(en).toBe('This coupon is already activated on your account.')
  })
})
