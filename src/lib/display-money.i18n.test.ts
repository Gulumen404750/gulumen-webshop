import { describe, expect, it } from 'vitest'
import { t } from '@/i18n/translations'
import en from '@/i18n/translations/en.json'
import de from '@/i18n/translations/de.json'
import ro from '@/i18n/translations/ro.json'
import { FALLBACK_HUF_PER_EUR } from '@/lib/euro-rate'
import { pointsCopyVars } from '@/lib/display-money'
import type { Locale } from '@/i18n/locales'

const KEYS = [
  'gamification.cartWalletHint',
  'gamification.mechanicsCashback',
  'gamification.mechanicsPurchase',
  'gamification.mechanicsGift',
  'profile.loyaltyHowItWorks',
  'payment.cashEarnHint',
  'payment.pointsRate',
  'payment.pointsNoStackHint',
  'payment.invoiceRemainderHint',
  'payment.useGiftPoints',
  'payment.useActivityPoints',
  'giftClaim.hint',
  'giftClaim.pageHint',
  'home.loyaltyText',
  'pages.shipping.fullDescription',
  'ai.shipping',
  'ai.default',
] as const

describe('foreign-language points copy', () => {
  it('has no leftover HUF amounts after interpolation in EN/DE/RO', () => {
    for (const locale of ['en', 'de', 'ro'] as Locale[]) {
      const dict = locale === 'en' ? en : locale === 'de' ? de : ro
      const vars = {
        ...pointsCopyVars(locale, FALLBACK_HUF_PER_EUR),
        gift: '10',
        activity: '20',
        points: '1',
        amount: pointsCopyVars(locale, FALLBACK_HUF_PER_EUR).earnAmount,
        days: '30',
        huf: 'should-not-appear',
        rate: '1',
      }
      for (const key of KEYS) {
        const text = t(dict, key, vars)
        expect(text, `${locale} ${key}`).not.toMatch(/\bHUF\b|\bFt\b|25[.\s]?000|50[.\s]?000|100 Ft|1 HUF|1 Ft/)
        expect(text, `${locale} ${key} leftover placeholder`).not.toMatch(/\{(shippingThreshold|loyaltyThreshold|pointValue|earnAmount)\}/)
      }
    }
  })
})
