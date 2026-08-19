import { describe, expect, it } from 'vitest'
import { localeNoticeText, type LocaleNotice } from '@/lib/locale-notice'
import { getTranslations, t as translate } from '@/i18n/translations'

describe('localeNoticeText', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(getTranslations(params?.lang === 'en' ? 'en' : 'hu'), key)

  it('translates from the stored key so a locale switch can change the text', () => {
    const notice: LocaleNotice = { key: 'giftClaim.errorCouponAlreadyClaimed' }
    const hu = localeNoticeText((key) => t(key, { lang: 'hu' }), notice)
    const en = localeNoticeText((key) => t(key, { lang: 'en' }), notice)
    expect(hu).toBe('Ez a kupon már aktiválva van a fiókodon.')
    expect(en).toBe('This coupon is already activated on your account.')
  })

  it('returns null when there is no notice', () => {
    expect(localeNoticeText(t, null)).toBeNull()
  })
})
