'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useCatCoupon } from './CatCouponContext'
import { useSourcingDealOrders } from './SourcingDealOrdersContext'
import { useProducts } from './ProductsContext'
import { getProductById as getProductByIdFromData, getMaxQty } from '@/lib/data'
import type { Product } from '@/lib/data'

const CART_STORAGE_KEY = 'gulumen-cart'

/** Opcionális termék opciók (pl. 3D: filament szín + anyag PLA/PETG). */
export type CartItemOptions = {
  colorName?: string
  colorHex?: string
  materialName?: string
}

function hasOptions(opts: CartItemOptions | undefined): boolean {
  return Boolean(
    opts &&
      (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
  )
}

/** Két kosár sor ugyanaz, ha productId és options (szín + anyag) is egyezik. */
function optionsEqual(a: CartItemOptions | undefined, b: CartItemOptions | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return !hasOptions(a) && !hasOptions(b)
  const colorA = a.colorHex ?? a.colorName ?? ''
  const colorB = b.colorHex ?? b.colorName ?? ''
  const matA = a.materialName ?? ''
  const matB = b.materialName ?? ''
  return colorA === colorB && matA === matB
}

/** Egyezik a kosár sor (ugyanaz a termék + ugyanaz a szín/változat). */
function sameCartLine(item: CartItem, productId: string, options?: CartItemOptions): boolean {
  return item.productId === productId && optionsEqual(item.options, options)
}

/**
 * A kosár NEM foglal készletet. A termék product.stock értéke SOHA nem változik
 * kosár művelet miatt. Csak productId + qty (+ opcionális options) tárolunk; a termék adatot mindig
 * a product listából (getProductById) kell lookupolni rendereléskor.
 * A kosár semmilyen körülmények között nem tárolhat Product referenciát.
 */
export type CartItem = {
  productId: string
  qty: number
  options?: CartItemOptions
}

type CartContextValue = {
  items: CartItem[]
  /** productSnapshot: ha a termékoldalról hívod, add át a product-ot, így a kosárba tétel nem függ a ProductsContext betöltésétől. */
  addItem: (productId: string, qty?: number, options?: CartItemOptions, productSnapshot?: Product) => void
  removeItem: (productId: string, options?: CartItemOptions) => void
  updateQty: (productId: string, qty: number, options?: CartItemOptions) => void
  clearCart: () => void
  subtotalHuf: number
  discountHuf: number
  totalHuf: number
  isDiscountActive: boolean
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((x: Record<string, unknown>) => {
      const opts = x.options as Record<string, unknown> | undefined
      return {
        productId: String(x.productId ?? ''),
        qty: Math.max(1, Number(x.qty) || 1),
        options:
          opts && (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
            ? {
                colorName: opts.colorName != null ? String(opts.colorName) : undefined,
                colorHex: opts.colorHex != null ? String(opts.colorHex) : undefined,
                materialName: opts.materialName != null ? String(opts.materialName) : undefined,
              }
            : undefined,
      }
    }).filter((x: CartItem) => x.productId !== '')
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isDiscountActive, discountPercent } = useCatCoupon()
  const { syncFromCart } = useSourcingDealOrders()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  const getProductById = useCallback(
    (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id),
    [getProductByIdFromContext]
  )

  useEffect(() => {
    setMounted(true)
    const loaded = loadCart()
    setItems(loaded)
    const sourcingItems = loaded.filter((item) => getProductById(item.productId)?.type === 'sourcing_deal')
    if (sourcingItems.length > 0) syncFromCart(sourcingItems)
  }, [syncFromCart, getProductById])

  useEffect(() => {
    if (mounted) saveCart(items)
  }, [items, mounted])

  const addItem = useCallback(
    (productId: string, qty = 1, options?: CartItemOptions, productSnapshot?: Product) => {
    setItems((prev) => {
      const product = productSnapshot ?? getProductById(productId)
      if (!product) return prev
      const normalizedOptions = hasOptions(options) ? options : undefined
      const existingLine = prev.find((x) => sameCartLine(x, productId, normalizedOptions))
      const currentQty = existingLine?.qty ?? 0
      const maxAllowed = getMaxQty(product)
      const toAdd = Math.min(qty, Math.max(0, maxAllowed - currentQty))
      if (toAdd <= 0) return prev
      const i = prev.findIndex((x) => sameCartLine(x, productId, normalizedOptions))
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + toAdd }
        return next
      }
      return [...prev, { productId, qty: toAdd, options: normalizedOptions }]
    })
  },
    [getProductById]
  )

  const removeItem = useCallback((productId: string, options?: CartItemOptions) => {
    setItems((prev) => {
      if (options != null && hasOptions(options)) {
        return prev.filter((x) => !sameCartLine(x, productId, options))
      }
      return prev.filter((x) => x.productId !== productId)
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number, options?: CartItemOptions) => {
    if (qty < 1) {
      setItems((prev) => {
        if (options != null && hasOptions(options)) {
          return prev.filter((x) => !sameCartLine(x, productId, options))
        }
        return prev.filter((x) => x.productId !== productId)
      })
      return
    }
    setItems((prev) =>
      prev.map((x) => (sameCartLine(x, productId, options) ? { ...x, qty } : x))
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const { subtotalHuf, discountHuf, totalHuf, itemCount } = useMemo(() => {
    let sub = 0
    let count = 0
    for (const item of items) {
      const p = getProductById(item.productId)
      const priceHuf = p ? (p.discountPriceHuf ?? p.priceHuf) : 0
      sub += priceHuf * item.qty
      count += item.qty
    }
    const disc = isDiscountActive ? Math.round(sub * discountPercent) : 0
    return {
      subtotalHuf: sub,
      discountHuf: disc,
      totalHuf: sub - disc,
      itemCount: count,
    }
  }, [items, isDiscountActive, discountPercent, getProductById])

  const value: CartContextValue = {
    items,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    subtotalHuf,
    discountHuf,
    totalHuf,
    isDiscountActive,
    itemCount,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
