'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/lib/data'
import { isSaleActive } from '@/lib/storefront-config'

/** Akció élő állapota – másodpercenként frissül, lejáratkor false. */
export function useSaleActive(product: Product): boolean {
  const [active, setActive] = useState(() => isSaleActive(product))

  useEffect(() => {
    const tick = () => setActive(isSaleActive(product))
    tick()
    if (!product.saleEndAt && !product.saleStartAt) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [
    product.id,
    product.onSale,
    product.discountPriceHuf,
    product.saleStartAt,
    product.saleEndAt,
  ])

  return active
}
