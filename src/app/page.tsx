import { getAllProductsAsync } from '@/lib/data'
import HomePageClient from './HomePageClient'

/**
 * Főoldal: Újdonságok és Akciók blokk az adatbázisból (adminban beállított termékek).
 * Csak az admin felületen (www.gulumen.com/admin) lehet módosítani; a főoldal automatikusan ezt mutatja.
 */
export const revalidate = 60

export default async function HomePage() {
  const all = await getAllProductsAsync()
  const stockOnly = all.filter((p) => p.type !== 'sourcing_deal')
  const newProducts = stockOnly.filter((p) => p.isNew).slice(0, 6)
  const dealProducts = stockOnly.filter((p) => p.onSale).slice(0, 6)

  return <HomePageClient newProducts={newProducts} dealProducts={dealProducts} />
}
