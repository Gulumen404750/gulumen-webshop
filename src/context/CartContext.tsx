'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useCatCoupon } from './CatCouponContext'
import { useSourcingDealOrders } from './SourcingDealOrdersContext'
import { useProducts } from './ProductsContext'
import { getProductById as getProductByIdFromData, getMaxQty } from '@/lib/data'
import type { Product } from '@/lib/data'
import { onLogoutCleanup } from '@/lib/logout-cleanup'
import {
  clearPersistedCart,
  loadPersistedCart,
  savePersistedCart,
  type CartItem,
  type CartItemOptions,
} from '@/lib/cart-storage'

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
export type { CartItem, CartItemOptions } from '@/lib/cart-storage'

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

export function CartProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, authChecked } = useAuth()
  const { isDiscountActive, discountPercent } = useCatCoupon()
  const { syncFromCart } = useSourcingDealOrders()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const wasLoggedInRef = useRef(false)

  const getProductById = useCallback(
    (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id),
    [getProductByIdFromContext]
  )

  useEffect(() => {
    setMounted(true)
    const loaded = loadPersistedCart()
    setItems(loaded)
    const sourcingItems = loaded.filter((item) => getProductById(item.productId)?.type === 'sourcing_deal')
    if (sourcingItems.length > 0) syncFromCart(sourcingItems)
  }, [syncFromCart, getProductById])

  useEffect(() => {
    return onLogoutCleanup(() => {
      setItems([])
      clearPersistedCart()
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return
    if (wasLoggedInRef.current && !isLoggedIn) {
      setItems([])
      clearPersistedCart()
    }
    wasLoggedInRef.current = isLoggedIn
  }, [isLoggedIn, authChecked])

  useEffect(() => {
    if (mounted) savePersistedCart(items)
  }, [items, mounted])

  useEffect(() => {
    if (!mounted || !authChecked || !isLoggedIn) return
    const timer = window.setTimeout(() => {
      if (items.length === 0) {
        fetch('/api/me/cart', { method: 'DELETE', credentials: 'include' }).catch(() => {})
      } else {
        fetch('/api/me/cart', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }).catch(() => {})
      }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [items, mounted, authChecked, isLoggedIn])

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

  const clearCart = useCallback(() => {
    setItems([])
    clearPersistedCart()
    // Szerver snapshot azonnal (ne várjon a 1.5s debounce-ra)
    if (typeof window !== 'undefined') {
      fetch('/api/me/cart', { method: 'DELETE', credentials: 'include' }).catch(() => {})
    }
  }, [])

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
