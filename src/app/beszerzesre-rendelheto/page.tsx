import { getSourcingDealProductsAsync, getSourcingDealStatus, isSourcingConsideredExpired, SOURCING_EXPIRED_BUFFER_MS } from '@/lib/data'
import { getProductOrdersCounts } from '@/lib/orders'
import { BeszerzesreRendelhetoClient } from './BeszerzesreRendelhetoClient'

/** Mindig friss adat: ne legyen cache, így frissítéskor sem ugrik vissza a számláló (localStorage ref marad). */
export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function BeszerzesreRendelhetoPage() {
  const all = await getSourcingDealProductsAsync()
  const productIds = all.map((p) => p.id)
  const countsMap = await getProductOrdersCounts(productIds)
  const products = all.map((p) => ({
    ...p,
    ordersCount: p.type === 'sourcing_deal' ? (countsMap[p.id] ?? 0) : 0,
  }))
  const serverNow = Date.now()

  // Csak aktív ajánlatok: lejárt soha ne jelenjen meg (boltban lehetetlen). Dupla küszöb: buffer + szigorú saleTo <= serverNow.
  const activeOnly = products.filter((p) => {
    if (p.type !== 'sourcing_deal' || !p.saleTo) return true
    const saleToMs = new Date(p.saleTo).getTime()
    if (saleToMs <= serverNow) return false
    if (saleToMs <= serverNow + SOURCING_EXPIRED_BUFFER_MS) return false
    if (isSourcingConsideredExpired(p, serverNow, p.ordersCount)) return false
    const status = getSourcingDealStatus(p, new Date(serverNow), p.ordersCount)
    return status === 'preview' || status === 'sale'
  })

  const sorted = [...activeOnly].sort((a, b) => {
    const tA = new Date(a.saleTo ?? 0).getTime()
    const tB = new Date(b.saleTo ?? 0).getTime()
    return tA - tB
  })
  return <BeszerzesreRendelhetoClient products={sorted} serverNow={serverNow} />
}
