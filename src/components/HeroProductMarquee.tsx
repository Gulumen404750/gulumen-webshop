'use client'

import { useMemo } from 'react'
import type { Product } from '@/lib/data'
import { getProductName } from '@/lib/data'
import { SafeProductImage } from '@/components/SafeProductImage'
import { useLocale } from '@/context/LocaleContext'

type Props = {
  products: Product[]
}

const MIN_LOOP_ITEMS = 10

function expandForLoop(products: Product[]): Product[] {
  if (products.length === 0) return []
  const out = [...products]
  while (out.length < MIN_LOOP_ITEMS) {
    out.push(...products)
  }
  return out
}

function MarqueeRow({
  products,
  reverse,
}: {
  products: Product[]
  reverse?: boolean
}) {
  const { locale } = useLocale()
  const loop = useMemo(() => {
    const base = expandForLoop(products)
    // Két azonos szegmens a zökkenőmentes -50% / +50% animációhoz
    return [...base, ...base]
  }, [products])

  if (loop.length === 0) return null

  return (
    <div
      className="hero-marquee-mask w-full overflow-hidden opacity-25 blur-[2px] sm:blur-[3px]"
      aria-hidden
    >
      <div
        className={`flex w-max gap-3 sm:gap-4 ${
          reverse ? 'animate-marquee-reverse' : 'animate-marquee'
        }`}
      >
        {loop.map((product, index) => {
          const name = getProductName(product, locale)
          return (
            <div
              key={`${product.id}-${index}`}
              className="relative h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[var(--card-bg)]/40"
            >
              <SafeProductImage
                src={product.image}
                alt={name}
                fit="cover"
                fill
                sizes="128px"
                optimize
                className="select-none"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Hero háttér: két ellentétes irányú, elmosott, végtelen terméksáv.
 */
export function HeroProductMarquee({ products }: Props) {
  const withImages = useMemo(
    () => products.filter((p) => Boolean(p.image?.trim())),
    [products]
  )

  const { topRow, bottomRow } = useMemo(() => {
    if (withImages.length === 0) return { topRow: [] as Product[], bottomRow: [] as Product[] }
    const mid = Math.ceil(withImages.length / 2)
    const top = withImages.slice(0, mid)
    const bottom = withImages.slice(mid)
    // Ha az egyik sor üres/kevés, mindkettő ugyanazt a készletet használja
    return {
      topRow: top.length > 0 ? top : withImages,
      bottomRow: bottom.length > 0 ? bottom : [...withImages].reverse(),
    }
  }, [withImages])

  if (withImages.length === 0) return null

  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none"
      aria-hidden
    >
      <div className="absolute inset-x-0 top-[8%] sm:top-[12%]">
        <MarqueeRow products={topRow} />
      </div>
      <div className="absolute inset-x-0 bottom-[8%] sm:bottom-[12%]">
        <MarqueeRow products={bottomRow} reverse />
      </div>
    </div>
  )
}
