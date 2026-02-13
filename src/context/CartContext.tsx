'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useCatCoupon } from './CatCouponContext'
import { useSourcingDealOrders } from './SourcingDealOrdersContext'
import { getProductById, getStockById } from '@/lib/data'

const CART_STORAGE_KEY = 'gulumen-cart'

/**
 * A kosár NEM foglal készletet. A termék product.stock értéke SOHA nem változik
 * kosár művelet miatt. Csak productId + qty tárolunk; a termék adatot mindig
 * a product listából (getProductById) kell lookupolni rendereléskor.
 * A kosár semmilyen körülmények között nem tárolhat Product referenciát.
 */
export type CartItem = {
  productId: string
  qty: number
}

type CartContextValue = {
  items: CartItem[]
  addItem: (productId: string, qty?: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
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
    return parsed.map((x: Record<string, unknown>) => ({
      productId: String(x.productId ?? ''),
      qty: Math.max(1, Number(x.qty) || 1),
    })).filter((x: CartItem) => x.productId !== '')
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
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const loaded = loadCart()
    setItems(loaded)
    const sourcingItems = loaded.filter((item) => getProductById(item.productId)?.type === 'sourcing_deal')
    if (sourcingItems.length > 0) syncFromCart(sourcingItems)
  }, [syncFromCart])

  useEffect(() => {
    if (mounted) saveCart(items)
  }, [items, mounted])

  const addItem = useCallback((productId: string, qty = 1) => {
    setItems((prev) => {
      const product = getProductById(productId)
      if (!product) return prev
      const maxAllowed =
        product.type === 'sourcing_deal'
          ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
          : getStockById(productId)
      const currentQty = prev.find((x) => x.productId === productId)?.qty ?? 0
      const toAdd = Math.min(qty, Math.max(0, maxAllowed - currentQty))
      if (toAdd <= 0) return prev
      const i = prev.findIndex((x) => x.productId === productId)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: next[i].qty + toAdd }
        return next
      }
      return [...prev, { productId, qty: toAdd }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((x) => x.productId !== productId))
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty < 1) {
      setItems((prev) => prev.filter((x) => x.productId !== productId))
      return
    }
    setItems((prev) =>
      prev.map((x) => (x.productId === productId ? { ...x, qty } : x))
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
  }, [items, isDiscountActive, discountPercent])

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
