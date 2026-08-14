'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

const PRODUCTS_HREF = '/termekek'
const PORTAL_MS = 1450

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function PortalOverlay({ label }: { label: string }) {
  const rings = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <div
      className="products-portal-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="products-portal-space" aria-hidden />
      <div className="products-portal-tunnel" aria-hidden>
        {rings.map((i) => (
          <span
            key={i}
            className="products-portal-ring"
            style={{ ['--ring-i' as string]: String(i) }}
          />
        ))}
        <span className="products-portal-core" />
      </div>
      <p className="products-portal-caption">{label}</p>
    </div>
  )
}

/**
 * Profil: arany, pulzáló Termékek CTA + sci-fi kapu átvezetés a /termekek oldalra.
 */
export function ProductsPortalButton() {
  const { t } = useLocale()
  const router = useRouter()
  const captionId = useId()
  const [opening, setOpening] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!opening) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      router.push(PRODUCTS_HREF)
    }, PORTAL_MS)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prev
    }
  }, [opening, router])

  const openPortal = useCallback(() => {
    if (opening) return
    if (prefersReducedMotion()) {
      router.push(PRODUCTS_HREF)
      return
    }
    setOpening(true)
    router.prefetch(PRODUCTS_HREF)
  }, [opening, router])

  return (
    <>
      <button
        type="button"
        onClick={openPortal}
        className="products-gold-cta shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-heading font-bold text-sm sm:text-base"
        aria-describedby={captionId}
        aria-label={t('profile.productsPortalAria')}
      >
        <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
        <span>{t('nav.products')}</span>
      </button>
      <span id={captionId} className="sr-only">
        {t('profile.productsPortalHint')}
      </span>
      {mounted && opening
        ? createPortal(
            <PortalOverlay label={t('profile.productsPortalOpening')} />,
            document.body
          )
        : null}
    </>
  )
}
