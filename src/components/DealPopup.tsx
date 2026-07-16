'use client'

import { useState, useEffect } from 'react'
import { LocaleLink as Link } from '@/components/LocaleLink'
import Image from 'next/image'
import { getProductName } from '@/lib/data'
import { useLocale } from '@/context/LocaleContext'
import type { Product } from '@/lib/data'

const STORAGE_KEY = 'gulumen-deal-popup-closed'

type PopupConfig = {
  enabled: boolean
  title: string
  description: string
}

export function DealPopup() {
  const { locale, t } = useLocale()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState<PopupConfig | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const closed = sessionStorage.getItem(STORAGE_KEY)
    if (closed !== 'true') setVisible(true)
  }, [mounted])

  useEffect(() => {
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
  }, [])

  const close = () => {
    setVisible(false)
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, 'true')
  }

  const show = visible && config?.enabled && products.length > 0

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
            {products.map((product) => {
              const priceHuf = product.discountPriceHuf ?? product.priceHuf
              const hasImage = product.image?.startsWith('/') || product.image?.startsWith('http')
              const isLocalImage = product.image?.startsWith('/')
              const productName = getProductName(product, locale)
              return (
                <Link
                  key={product.id}
                  href={`/termek/${product.slug}`}
                  onClick={close}
                  className="block rounded-xl border border-[var(--border)] overflow-hidden hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-[var(--card-bg)]"
                >
                  <div className="aspect-square bg-[var(--border)] relative">
                    {hasImage ? (
                      isLocalImage ? (
                        <Image
                          src={product.image}
                          alt={productName}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      ) : (
                        <img
                          src={product.image}
                          alt={productName}
                          className="absolute inset-0 w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">
                        {t('product.noImage')}
                      </div>
                    )}
                    {product.onSale && (
                      <span className="absolute top-2 left-2 rounded bg-discount text-white text-xs font-semibold px-2 py-0.5">
                        Akció
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-heading font-medium text-foreground text-sm line-clamp-2">
                      {productName}
                    </h3>
                    <p className="mt-1 text-discount font-semibold text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft
                    </p>
                  </div>
                </Link>
              )
            })}
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
