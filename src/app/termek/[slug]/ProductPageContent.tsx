'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Share2 } from 'lucide-react'
import { getDisplayStock, getProductName, getSourcingDealStatus, isUnlimitedStock } from '@/lib/data'
import { isValidImageUrl, normalizeImageUrl } from '@/lib/product-images'
import {
  cleanCdnUrls,
  cdnGalleryMainUrl,
  cdnThumbnailUrl,
  resolveImageUrl,
} from '@/lib/cdn'
import { SafeProductImage } from '@/components/SafeProductImage'
import { ProductTabs } from '@/components/ProductTabs'
import { SourcingDealBox } from '@/components/SourcingDealBox'
import { Breadcrumbs, productBreadcrumbs } from '@/components/Breadcrumbs'
import { ProductJsonLd } from '@/components/ProductJsonLd'
import { ProductCard } from '@/components/ProductCard'
import { ProductStaggerItem } from '@/components/ProductStaggerItem'
import { Lightbox } from '@/components/Lightbox'
import dynamic from 'next/dynamic'
import { Product360Viewer } from '@/components/Product360Viewer'
import { SoldImpactOverlay } from '@/components/SoldImpactOverlay'

import { ModelLoadingPlaceholder } from '@/components/ModelLoadingPlaceholder'

/** 3D model viewer csak kliensen, hogy ne váltsa ki a Node/V8 JIT hibát Windows alatt. */
const ProductModelViewer = dynamic(
  () => import('@/components/ProductModelViewer').then((m) => m.ProductModelViewer),
  { ssr: false, loading: () => <ModelLoadingPlaceholder /> }
)
import { is3DProduct } from '@/lib/data'
import {
  getAvailableColorVariants,
  shouldShowStorefrontColorPicker,
  getBaseColorVariant,
  getFilamentColorName,
  getGalleryImagesForColor,
  hasAnyColorImages,
  normalizeHexColor,
  type ColorVariant,
} from '@/lib/filamentColors'
import { defaultMaterialForProduct } from '@/lib/filamentMaterials'
import { buildColorableProductShareUrl } from '@/lib/product-share-url'
import { useLocale } from '@/context/LocaleContext'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/context/WishlistContext'
import { useEuroRate } from '@/context/EuroRateContext'
import { useToast } from '@/context/ToastContext'
import { trackAddToCart } from '@/lib/analytics'
import { SaleCountdown } from '@/components/SaleCountdown'
import { useSaleActive } from '@/hooks/useSaleActive'
import { useProductLikeToggle } from '@/hooks/useProductLikeToggle'
import type { Product } from '@/lib/data'

const RECENTLY_VIEWED_KEY = 'gulumen-recently-viewed'
const RECENTLY_VIEWED_MAX = 6

function useRecentlyViewed(productId: string, productSlug: string) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const next = [productId, ...list.filter((id) => id !== productId)].slice(0, RECENTLY_VIEWED_MAX)
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [productId, productSlug])
}

/** Szerver oldali viewsCount növelés – bot/admin a API-n kiszűrve. */
function useProductViewCount(productId: string) {
  useEffect(() => {
    if (!productId) return
    const key = `gulumen-viewed-${productId}`
    try {
      // Sessionenként egyszer (ugyanarra a termékre ne pörögjön feleslegesen)
      if (sessionStorage.getItem(key) === '1') return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage nem elérhető – akkor is elküldjük
    }
    void fetch(`/api/products/${encodeURIComponent(productId)}/view`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => {})
  }, [productId])
}

const showLikesForProduct = (type: string | undefined) => type === 'stock' || type === 'sourcing_deal'

type Props = { product: Product; slug: string; serverNow?: number; similarProducts: Product[] }

export function ProductPageContent({ product, slug, serverNow, similarProducts }: Props) {
  const { t, locale } = useLocale()
  const searchParams = useSearchParams()
  const { items, addItem, itemCount } = useCart()
  const { userId } = useAuth()
  const { isInWishlist, applyOptimisticToggle } = useWishlist()
  const { toast } = useToast()
  const isFavorite = isInWishlist(product.id)
  const [likesCount, setLikesCount] = useState(() => Math.max(0, product.likesCount ?? 0))
  const [pointLimitReached, setPointLimitReached] = useState(false)
  const { hufToEur, formatEur } = useEuroRate()
  useRecentlyViewed(product.id, product.slug)
  useProductViewCount(product.id)
  const productName = getProductName(product, locale)
  const cartQty = items.find((x) => x.productId === product.id)?.qty ?? 0
  const effectiveOrdersCount = (product.ordersCount ?? 0) + cartQty
  const unlimitedStock = product.type !== 'sourcing_deal' && isUnlimitedStock(product)
  const stockFromSource = product.type === 'sourcing_deal' ? getDisplayStock(product, effectiveOrdersCount) : getDisplayStock(product)
  const maxAddable = product.type === 'sourcing_deal'
    ? stockFromSource
    : unlimitedStock
      ? Math.max(0, stockFromSource - cartQty)
      : Math.max(0, stockFromSource - cartQty)
  const [addQty, setAddQty] = useState(1)
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [view360Open, setView360Open] = useState(false)
  const [show3DViewer, setShow3DViewer] = useState(false)
  const isColorable = !!product.isColorable
  const availableColors = getAvailableColorVariants(product.colorImages, isColorable)
  const usesColorGalleries = hasAnyColorImages(product.colorImages)
  /** Alapértelmezés: az Alaptermék (isBase) – a Kosárba gomb azonnal aktív. */
  const [selectedColor, setSelectedColor] = useState<ColorVariant | null>(() =>
    getBaseColorVariant(availableColors) ?? availableColors[0] ?? null
  )
  const sourcingStatus =
    product.type === 'sourcing_deal'
      ? getSourcingDealStatus(product, new Date(serverNow ?? Date.now()), effectiveOrdersCount)
      : null
  const [showSoldOverlay, setShowSoldOverlay] = useState<boolean>(
    () => sourcingStatus === 'closed' || sourcingStatus === 'soldout'
  )
  const safeAddQty = maxAddable > 0 ? Math.min(Math.max(1, addQty), maxAddable) : 1

  const images = cleanCdnUrls(
    getGalleryImagesForColor(product, selectedColor?.id).map(normalizeImageUrl).filter(isValidImageUrl)
  )
  const mainImage = resolveImageUrl(
    images[mainImageIndex] || images[0] || (isValidImageUrl(normalizeImageUrl(product.image || '')) ? normalizeImageUrl(product.image) : '')
  )
  const hasMultipleImages = images.length > 1
  const has360 = product.images360 && product.images360.length > 0
  const has3DModel = is3DProduct(product) && product.modelUrl

  const saleActive = useSaleActive(product)
  const priceHuf = saleActive && product.discountPriceHuf ? product.discountPriceHuf : product.priceHuf
  const priceEur = hufToEur(priceHuf)
  const hasDiscount = saleActive && !!product.discountPriceHuf

  /** Színválasztó csak több színvariációnál; egyszínű / „Nincs szín” terméknél rejtve. */
  const showColorPicker = shouldShowStorefrontColorPicker(product.colorImages, isColorable)
  const effectiveColor = selectedColor ?? (!showColorPicker ? getBaseColorVariant(availableColors) ?? availableColors[0] ?? null : null)
  const canAddToCart = !showColorPicker || selectedColor !== null
  const canShareConfiguration = showColorPicker && selectedColor !== null
  const adminMaterial = defaultMaterialForProduct(product.materials)

  const availableColorIds = availableColors.map((c) => c.id).join(',')

  useEffect(() => {
    if (!showColorPicker) {
      setSelectedColor(null)
      return
    }
    const colors = getAvailableColorVariants(product.colorImages, isColorable)
    if (colors.length === 0) {
      setSelectedColor(null)
      return
    }

    const colorParam = searchParams.get('color')
    if (colorParam) {
      const normalized = normalizeHexColor(colorParam, '')
      if (normalized) {
        const fromUrl = colors.find((c) => c.hex.toLowerCase() === normalized)
        if (fromUrl) {
          setSelectedColor(fromUrl)
          setMainImageIndex(0)
          return
        }
      }
    }

    // URL-ben nincs érvényes szín → tartsuk meg a jelenlegi érvényes választást, különben az Alaptermék
    setSelectedColor((prev) => {
      if (prev && colors.some((c) => c.id === prev.id)) return prev
      return getBaseColorVariant(colors) ?? colors[0] ?? null
    })
  }, [searchParams, showColorPicker, availableColorIds, product.colorImages, isColorable])

  const handleSelectColor = (color: ColorVariant) => {
    setSelectedColor(color)
    setMainImageIndex(0)
  }

  const handleShareConfiguration = useCallback(async () => {
    if (!canShareConfiguration || !selectedColor) return
    const url = buildColorableProductShareUrl(window.location.origin, slug, {
      colorHex: selectedColor.hex,
    })
    try {
      await navigator.clipboard.writeText(url)
      toast(t('product.shareCopied'))
    } catch {
      toast(t('product.shareCopied'))
    }
  }, [canShareConfiguration, selectedColor, slug, t, toast])

  const handleAddToCart = () => {
    if (!canAddToCart) return
    const color = effectiveColor
    const options =
      color || adminMaterial
        ? {
            ...(color
              ? {
                  colorName: getFilamentColorName(color, locale),
                  colorHex: color.hex,
                }
              : {}),
            ...(adminMaterial ? { materialName: adminMaterial } : {}),
          }
        : undefined
    addItem(product.id, safeAddQty, options, product)
    trackAddToCart(product.id, priceHuf * safeAddQty)
    toast(t('cart.toastAdded') || 'Termék a kosárban', {
      action: { label: t('buttons.openCart') || 'Kosár megnyitása', href: '/kosar' },
    })
  }

  const showLikes = showLikesForProduct(product.type)

  const onUnauthorizedLike = useCallback(() => {
    toast(t('wishlist.loginRequired') || 'Jelentkezz be a kedveléshez.')
  }, [toast, t])

  const { toggle: toggleLike, isToggling: isLikeToggling, shouldIgnoreExternalCount } =
    useProductLikeToggle({
      product,
      userId,
      isFavorite,
      likesCount,
      setLikesCount,
      onUnauthorized: onUnauthorizedLike,
      onPointLimit: setPointLimitReached,
    })

  useEffect(() => {
    if (!showLikes) return
    let cancelled = false
    fetch(`/api/products/${product.id}/like`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (cancelled || !data) return
        if (
          !shouldIgnoreExternalCount() &&
          typeof data.likesCount === 'number' &&
          Number.isFinite(data.likesCount)
        ) {
          setLikesCount(Math.max(0, Math.floor(data.likesCount)))
        }
        if (data?.liked === true && !isInWishlist(product.id) && !shouldIgnoreExternalCount()) {
          applyOptimisticToggle(product, true)
        }
        if (typeof data?.pointLimitReached === 'boolean') setPointLimitReached(data.pointLimitReached)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, showLikes, userId])

  const displayLikes = likesCount

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProductJsonLd product={product} />
      <Breadcrumbs
        items={productBreadcrumbs(product.category, productName, {
          productsLabel: t('nav.products'),
          locale,
        })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="space-y-2">
            {has3DModel && show3DViewer ? (
              <div className="space-y-3">
                <div className="relative aspect-[3/4] sm:aspect-square rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
                  <ProductModelViewer
                    src={product.modelUrl!}
                    alt={productName}
                    className="absolute inset-0 w-full h-full"
                    selectedColorHex={selectedColor?.hex}
                    enableFullscreen
                  />
                </div>
                <p className="text-center text-sm text-muted">
                  {t('product.view360Hint') || 'Húzd balra-jobbra a forgatáshoz · csipeteld a nagyításhoz'}
                </p>
                {showColorPicker && (
                  <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 lg:hidden">
                    <p className="text-sm font-medium text-foreground mb-2">
                      {t('product.color') || 'Szín'} * — {t('product.tapColorToTint') || 'Koppints egy színre a tok színezéséhez'}
                    </p>
                    <div
                      role="radiogroup"
                      aria-label={t('product.color') || 'Szín'}
                      className="flex flex-wrap gap-2"
                    >
                      {availableColors.map((color) => {
                        const colorName = getFilamentColorName(color, locale)
                        const isSelected = selectedColor?.id === color.id
                        return (
                          <button
                            key={`mobile-3d-${color.id}`}
                            type="button"
                            role="radio"
                            onClick={() => handleSelectColor(color)}
                            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors ${
                              isSelected
                                ? 'border-accent bg-accent/10 text-foreground'
                                : 'border-[var(--border)] bg-[var(--card-bg)] text-foreground hover:border-accent/50'
                            }`}
                            aria-checked={isSelected}
                            aria-label={colorName}
                            title={colorName}
                          >
                            <span
                              className="w-5 h-5 rounded-full shrink-0 border border-[var(--border)] shadow-inner"
                              style={{ backgroundColor: color.hex }}
                              aria-hidden
                            />
                            <span>{colorName}</span>
                            {color.isBase && (
                              <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">
                                {t('product.baseVariant') || 'Alap'}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShow3DViewer(false)}
                  className="w-full text-sm text-accent hover:underline"
                >
                  ← {t('product.backToImage') || 'Vissza a képhez'}
                </button>
              </div>
            ) : (
              <div
                className="w-full aspect-square rounded-xl border border-[var(--border)] bg-[var(--border)] relative overflow-hidden cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
                aria-label={t('product.openGallery') || 'Kép nagyítása / Galéria'}
              >
                <SafeProductImage
                  src={cdnGalleryMainUrl(mainImage)}
                  alt={productName}
                  fit="contain"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  optimize
                />
                {showSoldOverlay && <SoldImpactOverlay className="rounded-xl" label={t('status.expired')} />}
              </div>
            )}
            {has3DModel && !show3DViewer && (
              <button
                type="button"
                onClick={() => setShow3DViewer(true)}
                className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--card-bg)] py-2.5 text-sm font-medium text-foreground hover:border-accent/50 hover:bg-[var(--border)] transition-colors"
                aria-label={t('product.view3D') || '3D megtekintés'}
              >
                {t('product.view3D') || '🔄 Forgasd körbe (3D megtekintés)'}
              </button>
            )}
            {showColorPicker && !show3DViewer && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 lg:hidden">
                <p className="text-sm font-medium text-foreground mb-2">
                  {t('product.color') || 'Szín'} *
                </p>
                <div
                  role="radiogroup"
                  aria-label={t('product.color') || 'Szín'}
                  className="flex flex-wrap gap-2"
                >
                  {availableColors.map((color) => {
                    const colorName = getFilamentColorName(color, locale)
                    const isSelected = selectedColor?.id === color.id
                    return (
                      <button
                        key={`mobile-img-${color.id}`}
                        type="button"
                        role="radio"
                        onClick={() => handleSelectColor(color)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/10 text-foreground'
                            : 'border-[var(--border)] bg-[var(--card-bg)] text-foreground hover:border-accent/50'
                        }`}
                        aria-checked={isSelected}
                        aria-label={colorName}
                        title={colorName}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 border border-[var(--border)] shadow-inner"
                          style={{ backgroundColor: color.hex }}
                          aria-hidden
                        />
                        <span>{colorName}</span>
                        {color.isBase && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">
                            {t('product.baseVariant') || 'Alap'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {t('product.tapColorToTint') || 'Koppints egy színre. A 3D nézetben a tok ezzel a színnel jelenik meg.'}
                </p>
              </div>
            )}
          </div>
          {(hasMultipleImages || has360 || has3DModel) && (
            <div className="flex gap-2 overflow-x-auto items-center">
              {images.slice(0, 12).map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  onClick={() => setMainImageIndex(i)}
                  className={`w-20 h-20 shrink-0 rounded-lg border-2 bg-[var(--card-bg)] relative overflow-hidden transition-colors ${
                    mainImageIndex === i ? 'border-accent ring-2 ring-accent/30' : 'border-[var(--border)] hover:border-accent/50'
                  }`}
                  aria-label={`${productName} ${i + 1}`}
                  aria-pressed={mainImageIndex === i}
                >
                  {/* Csak 80px thumbnail (~KB) – a nagy kép a kattintáskor töltődik a főnézetbe */}
                  <SafeProductImage
                    src={cdnThumbnailUrl(img)}
                    alt=""
                    fit="cover"
                    fill
                    sizes="80px"
                    optimize
                    priority={i < 2}
                  />
                </button>
              ))}
              {has360 && (
                <button
                  type="button"
                  onClick={() => setView360Open(true)}
                  className="w-20 h-20 shrink-0 rounded-lg border-2 border-[var(--border)] bg-[var(--card-bg)] hover:border-accent/50 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-foreground"
                  aria-label={t('product.view360') || '360° megtekintés'}
                >
                  <span className="text-lg leading-none">360°</span>
                  <span>{t('product.view360') || '360°'}</span>
                </button>
              )}
              {has3DModel && !show3DViewer && (
                <button
                  type="button"
                  onClick={() => setShow3DViewer(true)}
                  className="w-20 h-20 shrink-0 rounded-lg border-2 border-[var(--border)] bg-[var(--card-bg)] hover:border-accent/50 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-foreground"
                  aria-label={t('product.view3D') || '3D megtekintés'}
                >
                  <span className="text-lg leading-none">3D</span>
                  <span>{t('product.view3D') || '3D'}</span>
                </button>
              )}
            </div>
          )}
          {lightboxOpen && (
            <Lightbox
              images={images}
              productName={productName}
              currentIndex={mainImageIndex}
              onClose={() => setLightboxOpen(false)}
              onIndexChange={setMainImageIndex}
            />
          )}
          {view360Open && has360 && product.images360 && (
            <Product360Viewer
              frames={product.images360}
              productName={productName}
              onClose={() => setView360Open(false)}
            />
          )}
        </div>

        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground">{productName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {showLikes && (
              <p className="text-sm text-muted flex items-center gap-1.5" aria-label={t('product.likesCount', { count: displayLikes })}>
                <span className="text-red-500" aria-hidden>❤️</span>
                <span className="tabular-nums font-medium text-foreground">{t('product.likesCount', { count: displayLikes })}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => toggleLike()}
              disabled={isLikeToggling}
              aria-busy={isLikeToggling}
              className="text-sm font-medium text-accent hover:underline disabled:opacity-70"
              aria-label={isFavorite ? (t('wishlist.remove') || 'Eltávolítás a kedvencekből') : (t('wishlist.add') || 'Kedvencekhez')}
            >
              {isFavorite ? (t('wishlist.remove') || 'Eltávolítás a kedvencekből') : (t('wishlist.add') || 'Kedvencekhez')}
            </button>
            {pointLimitReached && userId && !isFavorite && (
              <p className="text-xs text-muted w-full">{t('gamification.likeLimitReached')}</p>
            )}
          </div>
          <div className="mt-4 flex items-baseline gap-3 flex-wrap">
            {hasDiscount && (
              <span className="text-lg text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span className={`text-2xl ${hasDiscount ? 'text-discount font-bold' : 'text-foreground font-bold'}`}>
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
            <span className="text-muted">(€{formatEur(priceEur)})</span>
            {saleActive && product.type !== 'sourcing_deal' && (
              <SaleCountdown product={product} variant="inline" />
            )}
          </div>
          <p className="mt-2 text-muted">{t(`condition.${product.condition}`)}</p>
          {product.variants && product.variants.length > 0 && (
            <div className="mt-4">
              <span className="text-sm font-medium text-foreground">{t('product.sizeVariant')}: </span>
              <span className="text-muted">
                {product.variants.map((v) => v.size || v.color).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {product.type === 'sourcing_deal' ? (
            <div className="mt-6">
              <SourcingDealBox product={product} serverNow={serverNow} onExpired={() => setShowSoldOverlay(true)} />
            </div>
          ) : (
            <>
              {showColorPicker && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3">
                  <p id="product-color-label" className="text-sm font-medium text-foreground mb-2">
                    {t('product.color') || 'Szín'} *
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="product-color-label"
                    className="flex flex-wrap gap-2"
                  >
                    {availableColors.map((color) => {
                      const colorName = getFilamentColorName(color, locale)
                      const isSelected = selectedColor?.id === color.id
                      return (
                        <button
                          key={color.id}
                          type="button"
                          role="radio"
                          onClick={() => handleSelectColor(color)}
                          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent/10 text-foreground'
                              : 'border-[var(--border)] bg-[var(--card-bg)] text-foreground hover:border-accent/50'
                          }`}
                          aria-checked={isSelected}
                          aria-label={colorName}
                          title={colorName}
                        >
                          <span
                            className="w-5 h-5 rounded-full shrink-0 border border-[var(--border)] shadow-inner"
                            style={{ backgroundColor: color.hex }}
                            aria-hidden
                          />
                          <span>{colorName}</span>
                          {color.isBase && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">
                              {t('product.baseVariant') || 'Alap'}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {usesColorGalleries
                      ? t('product.selectColorHintWithPhotos') ||
                        'A kiválasztott színhez tartozó termékfotók jelennek meg; a kosárba is ez a szín kerül.'
                      : t('product.selectColorHint') ||
                        'A kosárba a kiválasztott szín kerül; a termékfotó csak illusztráció.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleShareConfiguration()}
                    disabled={!canShareConfiguration}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canShareConfiguration ? t('product.shareNeedSelection') : undefined}
                  >
                    <Share2 className="w-4 h-4 shrink-0" aria-hidden />
                    {t('product.share')}
                  </button>
                </div>
              )}
              <p className="mt-2 text-sm text-foreground">
                <strong>{t('product.inStock')}</strong>
                {unlimitedStock || has3DModel
                  ? ` – ${t('product.inStockUnlimited') || 'rendelhető'}`
                  : stockFromSource > 0
                    ? ` – ${t('product.inStockCount', { count: stockFromSource })}`
                    : ''}
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
                  {showColorPicker && !selectedColor && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium w-full">
                      {t('product.selectColorToAdd') || 'Válaszd ki a színt a kosárba tétel előtt.'}
                    </p>
                  )}
                  {maxAddable > 0 && canAddToCart && (
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
                        {Array.from({ length: unlimitedStock || has3DModel ? Math.min(maxAddable, 99) : maxAddable }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="inline-block px-8 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        {t('buttons.addToCart')}
                      </button>
                    </>
                  )}
                  {maxAddable > 0 && !canAddToCart && (
                    <button
                      type="button"
                      disabled
                      className="inline-block px-8 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed"
                    >
                      {t('buttons.addToCart')}
                    </button>
                  )}
                  {maxAddable === 0 && (
                    <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">
                      {t('product.maxInCart')}
                    </p>
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

      {similarProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[var(--border)]">
          <h2 className="font-heading text-xl font-bold text-foreground mb-6">{t('product.similarProducts') || 'Hasonló termékek'}</h2>
          <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProducts.map((p, i) => (
              <ProductStaggerItem key={p.id} index={i}>
                <ProductCard product={p} />
              </ProductStaggerItem>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
