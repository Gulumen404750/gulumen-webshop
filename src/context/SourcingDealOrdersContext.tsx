'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type OrdersMap = Record<string, number>

const SourcingDealOrdersContext = createContext<{
  getOrdersCount: (productId: string) => number
  placeOrder: (productId: string, qty?: number) => void
  cancelOrder: (productId: string, qty?: number) => void
} | null>(null)

export function SourcingDealOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<OrdersMap>({})

  const getOrdersCount = useCallback((productId: string) => orders[productId] ?? 0, [orders])

  const placeOrder = useCallback((productId: string, qty: number = 1) => {
    setOrders((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + qty }))
  }, [])

  const cancelOrder = useCallback((productId: string, qty: number = 1) => {
    setOrders((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) - qty),
    }))
  }, [])

  return (
    <SourcingDealOrdersContext.Provider value={{ getOrdersCount, placeOrder, cancelOrder }}>
      {children}
    </SourcingDealOrdersContext.Provider>
  )
}

export function useSourcingDealOrders() {
  const ctx = useContext(SourcingDealOrdersContext)
  if (!ctx) return { getOrdersCount: () => 0, placeOrder: () => {}, cancelOrder: () => {} }
  return ctx
}
