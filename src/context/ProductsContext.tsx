'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Product } from '@/lib/data'

type ProductsContextValue = {
  products: Product[]
  getProductById: (id: string) => Product | undefined
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetch('/api/products', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Product[]) => {
        if (Array.isArray(data)) setProducts(data)
      })
      .catch(() => setProducts([]))
  }, [])

  const getProductById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  )

  const value = useMemo<ProductsContextValue>(
    () => ({ products, getProductById }),
    [products, getProductById]
  )

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider')
  return ctx
}
