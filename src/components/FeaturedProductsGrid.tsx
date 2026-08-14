'use client'

import { useState, useEffect, useRef } from 'react'
import type { Product } from '@/lib/data'
import { ProductCard } from '@/components/ProductCard'
import { ProductStaggerItem } from '@/components/ProductStaggerItem'
import { FEATURED_PRODUCT_COUNT, FEATURED_ROTATION_MS } from '@/lib/storefront-config'

type Props = {
  initialProducts: Product[]
  newProducts: Product[]
  dealProducts: Product[]
}

function pickFromPool(
  pool: Product[],
  current: Product[],
  cursor: number
): { product: Product; nextCursor: number } | null {
  if (pool.length === 0) return null
  const currentIds = new Set(current.map((p) => p.id))
  for (let i = 0; i < pool.length; i++) {
    const idx = (cursor + i) % pool.length
    const candidate = pool[idx]
    if (!currentIds.has(candidate.id)) {
      return { product: candidate, nextCursor: (idx + 1) % pool.length }
    }
  }
  const product = pool[cursor % pool.length]
  return { product, nextCursor: (cursor + 1) % pool.length }
}

export function FeaturedProductsGrid({ initialProducts, newProducts, dealProducts }: Props) {
  const [displayed, setDisplayed] = useState(() =>
    initialProducts.slice(0, FEATURED_PRODUCT_COUNT)
  )
  const slotRef = useRef(0)
  const useNewPoolRef = useRef(true)
  const newCursorRef = useRef(0)
  const dealCursorRef = useRef(0)

  useEffect(() => {
    if (newProducts.length === 0 && dealProducts.length === 0) return

    const id = setInterval(() => {
      setDisplayed((current) => {
        const wantNew = useNewPoolRef.current
        let pool = wantNew ? newProducts : dealProducts
        let cursorRef = wantNew ? newCursorRef : dealCursorRef

        if (pool.length === 0) {
          pool = wantNew ? dealProducts : newProducts
          cursorRef = wantNew ? dealCursorRef : newCursorRef
        }
        if (pool.length === 0) return current

        const picked = pickFromPool(pool, current, cursorRef.current)
        if (!picked) return current

        cursorRef.current = picked.nextCursor
        useNewPoolRef.current = !useNewPoolRef.current

        const slot = slotRef.current
        slotRef.current = (slot + 1) % FEATURED_PRODUCT_COUNT

        const next = [...current]
        next[slot] = picked.product
        return next
      })
    }, FEATURED_ROTATION_MS)

    return () => clearInterval(id)
  }, [newProducts, dealProducts])

  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
      {displayed.map((p, i) => (
        <ProductStaggerItem key={`${i}-${p.id}`} index={i}>
          <ProductCard product={p} priority={i < 3} />
        </ProductStaggerItem>
      ))}
    </div>
  )
}
