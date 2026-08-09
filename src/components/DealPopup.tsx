'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getProductName } from '@/lib/data'
import { SafeProductImage } from '@/components/SafeProductImage'
import { useLocale } from '@/context/LocaleContext'
import { SaleCountdown } from '@/components/SaleCountdown'
import { useSaleActive } from '@/hooks/useSaleActive'
import { getSaleDiscountPercent } from '@/lib/storefront-config'
import type { Product } from '@/lib/data'

const STORAGE_KEY = 'gulumen-deal-popup-closed'

type PopupConfig = {
  enabled: boolean
  title: string
  description: string
}

/**
 * Storefront akciós popup.
 * Admin beállítás: /admin/dashboard/deal-popup (enabled + termékek).
 * Feltétel: enabled && products.length > 0 && session-ben még nem zárták be.
 * Admin / fizetés útvonalakon nem jelenik meg.
 */
export function DealPopup() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState<PopupConfig | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  const suppressOnPath =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/fizetes') ||
    pathname?.startsWith('/profil')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || suppressOnPath) return
    const closed = sessionStorage.getItem(STORAGE_KEY)
    if (closed !== 'true') setVisible(true)
  }, [mounted, suppressOnPath])

  useEffect(() => {
    if (suppressOnPath) return
    let cancelled = false
    async function fetchPopup() {
      try {
        const res = await fetch('/api/deal-popup')
        const data = await res.json()
        if (cancelled) return
        setConfig(data.config ?? { enabled: false, title: '', description: '' })
        setProducts(Array.isArray(data.products) ? data.products : [])
      } catch {
        if (!cancelled) {
          setConfig({ enabled: false, title: '', description: '' })
          setProducts([])
        }
      }
    }
    fetchPopup()
    return () => { cancelled = true }
  }, [suppressOnPath])

  const close = () => {
    setVisible(false)
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, 'true')
  }

  const show = !suppressOnPath && visible && config?.enabled && products.length > 0

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl">
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-muted hover:text-foreground hover:bg-[var(--border)] transition-colors"
          aria-label="Bezárás"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-6 pt-12">
          <h2 className="font-heading text-xl font-bold text-foreground mb-4 text-center">
            {config?.title || 'Akciók most'}
          </h2>
          <p className="text-muted text-sm text-center mb-6">
            {config?.description || 'Válogatás az aktuális akcióinkból – mindig meglepően jó áron.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {products.map((product) => (
              <DealPopupProduct key={product.id} product={product} onNavigate={close} />
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/akciok"
              onClick={close}
              className="inline-block px-6 py-2 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Összes akció megtekintése
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DealPopupProduct({ product, onNavigate }: { product: Product; onNavigate: () => void }) {
  const { locale, t } = useLocale()
  const saleActive = useSaleActive(product)
  const priceHuf = saleActive && product.discountPriceHuf ? product.discountPriceHuf : product.priceHuf
  const hasDiscount = saleActive && !!product.discountPriceHuf
  const salePercent = saleActive ? getSaleDiscountPercent(product) : null
  const productName = getProductName(product, locale)

  return (
    <Link
      href={`/termek/${product.slug}`}
      onClick={onNavigate}
      className="block rounded-xl border border-[var(--border)] overflow-hidden hover:border-accent hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-[var(--card-bg)]"
    >
      <div className="aspect-square bg-[var(--border)] relative">
        <SafeProductImage
          src={product.image}
          alt={productName}
          fit="cover"
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        {saleActive && (
          <span className="absolute top-2 left-2 rounded bg-discount text-white text-xs font-bold px-2 py-0.5 shadow-sm">
            {salePercent != null ? `-${salePercent}%` : t('status.deal')}
          </span>
        )}
        {saleActive && <SaleCountdown product={product} variant="overlay" />}
      </div>
      <div className="p-3">
        <h3 className="font-heading font-medium text-foreground text-sm line-clamp-2">
          {productName}
        </h3>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          {hasDiscount && (
            <span className="text-xs text-muted line-through">
              {product.priceHuf.toLocaleString('hu-HU')} Ft
            </span>
          )}
          <span className={`font-semibold text-sm ${hasDiscount ? 'text-discount' : 'text-foreground'}`}>
            {priceHuf.toLocaleString('hu-HU')} Ft
          </span>
        </div>
      </div>
    </Link>
  )
}
