'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { CallUsModal } from '@/components/CallUsModal'
import { Phone } from 'lucide-react'

export function Footer() {
  const { t } = useLocale()
  const [callUsModalOpen, setCallUsModalOpen] = useState(false)

  return (
    <>
      <footer className="border-t border-[var(--border)] bg-[var(--card-bg)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-muted">
            <Link href="/kapcsolat" className="hover:text-foreground hover:underline">
              {t('nav.contact')}
            </Link>
            <Link href="/szallitas" className="hover:text-foreground hover:underline">
              {t('nav.shipping')}
            </Link>
            <Link href="/visszakuldes" className="hover:text-foreground hover:underline">
              {t('nav.returns')}
            </Link>
            <Link href="/kapcsolat#telefonos-adatkezeles" className="hover:text-foreground hover:underline">
              {t('callUs.recordingNoticeLink')}
            </Link>
            <button
              type="button"
              onClick={() => setCallUsModalOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline text-current"
            >
              <Phone className="w-4 h-4" />
              {t('callUs.title')}
            </button>
          </div>
          <p className="text-center text-xs text-muted mt-6">
            © {new Date().getFullYear()} Gulumen. {t('nav.help')}.
          </p>
        </div>
      </footer>
      <CallUsModal isOpen={callUsModalOpen} onClose={() => setCallUsModalOpen(false)} />
    </>
  )
}
