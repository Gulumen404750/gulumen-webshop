import { getSourcingDealProductsAsync, getSourcingDealStatus, isSourcingConsideredExpired } from '@/lib/data'
import { getProductOrdersCounts } from '@/lib/orders'
import { getServerTimeMs } from '@/lib/server-time'
import { LejartTermekekClient } from './LejartTermekekClient'

const EXPIRED_WINDOW_MS = 5 * 24 * 60 * 60 * 1000 // 5 nap

/** Mindig friss lista: a most lejárt termék azonnal megjelenik a Lejárt termékek oldalon. */
export const revalidate = 0
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lejárt termékek',
}

export default async function LejartTermekekPage() {
  const all = await getSourcingDealProductsAsync()
  const productIds = all.map((p) => p.id)
  const countsMap = await getProductOrdersCounts(productIds)
  const products = all.map((p) => ({
    ...p,
    ordersCount: countsMap[p.id] ?? 0,
  }))

  const serverNow = await getServerTimeMs()
  const cutoff = serverNow - EXPIRED_WINDOW_MS

  // Lejárt + „már lejártnak tekintett” (buffer): ugyanazzal a küszöbbel, mint az aktív lista, így a termék nem „sehol” nem lesz, hanem itt megjelenik.
  const expiredOrSoldout = products.filter((p) => {
    if (!isSourcingConsideredExpired(p, serverNow, p.ordersCount)) return false
    const expiredAt = p.saleTo ? new Date(p.saleTo).getTime() : 0
    return expiredAt >= cutoff
  })

  const sorted = [...expiredOrSoldout].sort((a, b) => {
    const tA = new Date(a.saleTo ?? 0).getTime()
    const tB = new Date(b.saleTo ?? 0).getTime()
    return tB - tA
  })

  return <LejartTermekekClient products={sorted} serverNow={serverNow} />
}
