'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { getProductBySlug, getStockById, getProductName } from '@/lib/data'
import { ProductTabs } from '@/components/ProductTabs'
import { SourcingDealBox } from '@/components/SourcingDealBox'
import { useLocale } from '@/context/LocaleContext'
import { useCart } from '@/context/CartContext'

export default function ProductPage({ params }: { params: { slug: string } }) {
  const { t, locale } = useLocale()
  const { items } = useCart()
  const product = getProductBySlug(params.slug)
  if (!product) notFound()
  const productName = getProductName(product, locale)
  const cartQty = items.find((x) => x.productId === product.id)?.qty ?? 0
  const stockFromSource = product.type !== 'sourcing_deal' ? getStockById(product.id) : 0
  const maxAddable = Math.max(0, stockFromSource - cartQty)
  const [addQty, setAddQty] = useState(1)
  const safeAddQty = maxAddable > 0 ? Math.min(Math.max(1, addQty), maxAddable) : 1

  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const priceEur = product.discountPriceEur ?? product.priceEur
  const hasDiscount = !!product.discountPriceHuf

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="aspect-square rounded-xl border border-[var(--border)] bg-[var(--border)] relative overflow-hidden">
            {product.image.startsWith('/') ? (
              <Image src={product.image} alt={productName} fill className="object-contain" sizes="(max-width: 1024px) 100vw, 50vw" priority />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted">{t('product.noImage')}</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.slice(0, 4).map((img, i) => (
                <div key={i} className="w-20 h-20 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] relative overflow-hidden">
                  {img.startsWith('/') && <Image src={img} alt={`${productName} ${i + 1}`} fill className="object-cover" sizes="80px" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground">{productName}</h1>
          <div className="mt-4 flex items-baseline gap-3 flex-wrap">
            {hasDiscount && (
              <span className="text-lg text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span className={`text-2xl ${hasDiscount ? 'text-discount font-bold' : 'text-foreground font-bold'}`}>
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
            <span className="text-muted">(€{priceEur})</span>
          </div>
          <p className="mt-2 text-muted">{product.condition}</p>
          {product.variants && product.variants.length > 0 && (
            <div className="mt-4">
              <span className="text-sm font-medium text-foreground">Méret / változat: </span>
              <span className="text-muted">
                {product.variants.map((v) => v.size || v.color).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {product.type === 'sourcing_deal' ? (
            <div className="mt-6">
              <SourcingDealBox product={product} />
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-foreground">
                <strong>{t('product.inStock')}</strong> – {t('product.inStockCount', { count: stockFromSource })}
              </p>
              {cartQty > 0 && (
                <p className="mt-1 text-sm text-muted">
                  {t('product.inCartCount', { count: cartQty })}
                </p>
              )}
              <p className="mt-1 text-sm text-muted">
                {t('product.shippingNote')} <strong className="text-foreground">{t('product.shipping24_48')}</strong>.
              </p>
              {stockFromSource > 0 ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {maxAddable > 0 && (
                    <>
                      <label htmlFor="product-qty" className="text-sm font-medium text-foreground">
                        {t('product.quantity')}:
                      </label>
                      <select
                        id="product-qty"
                        value={safeAddQty}
                        onChange={(e) => setAddQty(Math.min(maxAddable, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-foreground min-w-[4rem]"
                      >
                        {Array.from({ length: maxAddable }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <Link
                        href={`/kosar?add=${product.id}&qty=${safeAddQty}`}
                        className="inline-block px-8 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        {t('buttons.addToCart')}
                      </Link>
                    </>
                  )}
                  {maxAddable === 0 && (
                    <p className="text-muted text-sm">{t('product.inStockCount', { count: stockFromSource })}</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-6 px-8 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed"
                >
                  {t('status.soldOut')}
                </button>
              )}
            </>
          )}

          <div className="mt-10">
            <ProductTabs product={product} />
          </div>
        </div>
      </div>
    </div>
  )
}
