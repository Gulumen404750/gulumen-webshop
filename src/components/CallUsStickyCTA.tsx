'use client'

import { useLocale } from '@/context/LocaleContext'
import { Phone } from 'lucide-react'
import { MOBILE_FAB_Z, mobileFabBottom, mobileFabLeft } from '@/lib/mobile-fab-layout'

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+36301234567'
const TEL_LINK = `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`

/**
 * Mobilon sticky „Hívj minket” CTA – bal alsó sarok (AI chat jobb alsó).
 */
export function CallUsStickyCTA() {
  const { t } = useLocale()

  return (
    <div
      className="fixed md:hidden"
      style={{ left: mobileFabLeft, bottom: mobileFabBottom, zIndex: MOBILE_FAB_Z }}
      aria-label={t('callUs.title')}
    >
      <a
        href={TEL_LINK}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
        aria-label={t('callUs.title')}
      >
        <Phone className="w-6 h-6" />
      </a>
    </div>
  )
}
