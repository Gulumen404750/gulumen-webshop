import { describe, expect, it } from 'vitest'
import { t } from '@/i18n/translations'
import hu from '@/i18n/translations/hu.json'
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
  'payment.cashEarnHintInstallment',
  'payment.pointsRate',
  'payment.pointsNoStackHint',
  'payment.invoiceRemainderHint',
  'payment.useGiftPoints',
  'payment.useActivityPoints',
  'payment.couponMinOrder',
  'payment.pointsPromoStackDisabled',
  'payment.couponSelectorEmptyWithPoints',
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
        expect(text, `${locale} ${key} leftover placeholder`).not.toMatch(/\{(shippingThreshold|loyaltyThreshold|loyaltyMaxPercent|pointValue|earnAmount)\}/)
      }
    }
  })
})

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

describe('translation file key parity', () => {
  it('keeps EN/DE/RO keys in sync with HU', () => {
    const huKeys = flattenKeys(hu as Record<string, unknown>).sort()
    for (const [name, dict] of [
      ['en', en],
      ['de', de],
      ['ro', ro],
    ] as const) {
      const keys = flattenKeys(dict as Record<string, unknown>).sort()
      const missing = huKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !huKeys.includes(k))
      expect(missing, `${name} missing keys`).toEqual([])
      expect(extra, `${name} extra keys`).toEqual([])
    }
  })
})
