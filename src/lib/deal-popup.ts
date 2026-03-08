/**
 * Akciós popup konfiguráció és termékfeloldás.
 * - Admin kiválaszt 3 terméket (csak akciósak közül), sorrend állítható.
 * - Ha egy kiesik (elfogyott, inaktív, törölt), automatikus pótlás másik akciós termékkel.
 * - Konfiguráció a Setting táblában (deal_popup_config), ha nincs DB → nincs admin config.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import type { Product } from '@/lib/data'

const SETTING_KEY = 'deal_popup_config'

export type DealPopupConfig = {
  enabled: boolean
  title: string
  description: string
  /** Max 3 termék id, sorrend szerint. */
  productIds: string[]
}

const DEFAULT_CONFIG: DealPopupConfig = {
  enabled: true,
  title: 'Akciók most',
  description: 'Válogatás az aktuális akcióinkból – mindig meglepően jó áron.',
  productIds: [],
}

export { DEFAULT_CONFIG }

/** Megfelelő akciós termék a popupba: akciós, aktív, megjeleníthető, van képe, neve, ára. */
export function isEligibleForDealPopup(p: Product): boolean {
  if (!p.onSale) return false
  if (p.type === 'sourcing_deal') return false
  const hasImage = Boolean(p.image && String(p.image).trim())
  const hasName = Boolean(
    (p.name && String(p.name).trim()) ||
    (p.nameEn && String(p.nameEn).trim())
  )
  const hasPrice = Number(p.discountPriceHuf ?? p.priceHuf) > 0
  return hasImage && hasName && hasPrice
}

/** Összes megfelelő akciós termék (DB vagy mock). */
export async function getEligibleDealProducts(products: Product[]): Promise<Product[]> {
  return products.filter(isEligibleForDealPopup)
}

/** Beállítás lekérése a DB-ből. */
export async function getDealPopupConfigFromDb(): Promise<DealPopupConfig | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
    if (!row?.value) return null
    const parsed = JSON.parse(row.value) as Partial<DealPopupConfig>
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      title: parsed.title ?? DEFAULT_CONFIG.title,
      description: parsed.description ?? DEFAULT_CONFIG.description,
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds.slice(0, 3) : [],
    }
  } catch {
    return null
  }
}

/** Beállítás mentése (admin). */
export async function setDealPopupConfigInDb(config: DealPopupConfig): Promise<void> {
  if (!isDbConfigured()) throw new Error('Database not configured')
  const value = JSON.stringify({
    enabled: config.enabled,
    title: config.title ?? DEFAULT_CONFIG.title,
    description: config.description ?? DEFAULT_CONFIG.description,
    productIds: (config.productIds ?? []).slice(0, 3),
  })
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  })
}

/**
 * Visszaadja a popupban megjelenítendő 3 terméket.
 * - Elsőbbség: admin által kiválasztott productIds (sorrendben).
 * - Ha egy kiesik (nem eligible), helyette másik eligible termék (amit még nem használtunk).
 * - Ha kevesebb mint 3 a kiválasztott, kiegészítjük eligible termékekkel.
 */
export function resolveDealPopupProducts(
  config: DealPopupConfig | null,
  eligibleProducts: Product[]
): Product[] {
  const result: Product[] = []
  const usedIds = new Set<string>()
  const byId = new Map(eligibleProducts.map((p) => [p.id, p]))

  const preferredIds = config?.productIds ?? []

  // 1) Admin által kiválasztottak (sorrendben), ha még eligible és még nincs benne
  for (const id of preferredIds) {
    if (result.length >= 3) break
    const p = byId.get(id)
    if (p && !usedIds.has(p.id)) {
      result.push(p)
      usedIds.add(p.id)
    }
  }

  // 2) Kiegészítés más eligible termékekkel (ne ismételjük)
  for (const p of eligibleProducts) {
    if (result.length >= 3) break
    if (!usedIds.has(p.id)) {
      result.push(p)
      usedIds.add(p.id)
    }
  }

  return result
}
