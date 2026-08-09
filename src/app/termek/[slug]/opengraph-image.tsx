import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { getProductBySlugAsync, getProductName } from '@/lib/data'
import { isSaleActive } from '@/lib/storefront-config'
import {
  formatHufPrice,
  getProductDisplayPriceHuf,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  toAbsoluteAssetUrl,
  truncateProductName,
} from '@/lib/product-og-image'
import { getServerLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'

export const runtime = 'nodejs'
export const revalidate = 10

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export async function generateImageMetadata({ params }: Props) {
  const { slug } = await params
  const locale = await getServerLocale()
  const dict = getTranslations(locale)
  const product = await getProductBySlugAsync(slug)
  const name = product ? getProductName(product, locale) : ''
  return [
    {
      id: slug,
      alt: name ? `${name} – Gulumen` : t(dict, 'seo.productImageAlt'),
      size: { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
      contentType: 'image/png',
    },
  ]
}

export default async function ProductOgImage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlugAsync(slug)
  if (!product) notFound()

  const locale = await getServerLocale()
  const saleActive = isSaleActive(product)
  const priceHuf = getProductDisplayPriceHuf(product)
  const priceLabel = formatHufPrice(priceHuf)
  const showStrike = saleActive && product.discountPriceHuf != null && product.discountPriceHuf < product.priceHuf
  const strikeLabel = showStrike ? formatHufPrice(product.priceHuf) : null
  const productName = truncateProductName(getProductName(product, locale))
  const imageUrl = toAbsoluteAssetUrl(product.image)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0c4a6e 100%)',
          padding: 56,
          fontFamily: 'system-ui, Segoe UI, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            gap: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 420,
              height: 420,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src={imageUrl}
              alt=""
              width={380}
              height={380}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              color: '#f8fafc',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#7dd3fc',
              }}
            >
              Gulumen
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.15,
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {productName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, gap: 8 }}>
              <div style={{ fontSize: 44, fontWeight: 700, color: '#38bdf8' }}>{priceLabel}</div>
              {strikeLabel && (
                <div style={{ fontSize: 28, color: '#94a3b8', textDecoration: 'line-through' }}>
                  {strikeLabel}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    }
  )
}
