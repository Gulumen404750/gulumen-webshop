/**
 * Storefront chat: aktuális termék kontextus az OpenAI system message-hez.
 * Az ár mindig az adatbázis éles akcióablaka szerint számítódik.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { productSlugLookupCandidates } from '@/lib/slug'
import { isSaleActive } from '@/lib/storefront-config'
import type { Product } from '@/lib/data'
import {
  formatCustomerPrice,
  usesEuroCopy,
  type CustomerMoneyDisplay,
} from '@/lib/display-money'

/** Termékoldal slug a pathname-ből: /termek/[slug] vagy /products/[slug] */
export function extractProductSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(/^\/(?:termek|products)\/([^/?#]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export type ChatProductContextRow = {
  id: string
  slug: string
  name: string
  priceHuf: number
  discountPriceHuf: number | null
  onSale: boolean
  saleStartAt: Date | string | null
  saleEndAt: Date | string | null
  description_hu: string | null
  aiKnowledgeBase: string | null
  stock: number
  active: boolean
  archived: boolean
}

export type ChatProductPricing = {
  normalPriceHuf: number
  effectivePriceHuf: number
  isSale: boolean
}

/** Éles ár: akciós ablak + discountPriceHuf alapján. */
export function resolveChatProductPricing(
  product: Pick<
    ChatProductContextRow,
    'priceHuf' | 'discountPriceHuf' | 'onSale' | 'saleStartAt' | 'saleEndAt'
  >,
  now: Date = new Date()
): ChatProductPricing {
  const saleProduct = {
    onSale: product.onSale,
    discountPriceHuf: product.discountPriceHuf ?? undefined,
    priceHuf: product.priceHuf,
    saleStartAt:
      product.saleStartAt instanceof Date
        ? product.saleStartAt.toISOString()
        : product.saleStartAt ?? undefined,
    saleEndAt:
      product.saleEndAt instanceof Date
        ? product.saleEndAt.toISOString()
        : product.saleEndAt ?? undefined,
  } as Product

  const isSale = isSaleActive(saleProduct, now)
  if (isSale && typeof product.discountPriceHuf === 'number') {
    return {
      normalPriceHuf: product.priceHuf,
      effectivePriceHuf: product.discountPriceHuf,
      isSale: true,
    }
  }
  return {
    normalPriceHuf: product.priceHuf,
    effectivePriceHuf: product.priceHuf,
    isSale: false,
  }
}

/** @deprecated Használd a resolveChatProductPricing-et (akcióablak-tudatos). */
export function resolveChatProductPriceHuf(product: {
  priceHuf: number
  discountPriceHuf?: number | null
  onSale?: boolean
  saleStartAt?: Date | string | null
  saleEndAt?: Date | string | null
}): number {
  return resolveChatProductPricing({
    priceHuf: product.priceHuf,
    discountPriceHuf: product.discountPriceHuf ?? null,
    onSale: product.onSale ?? false,
    saleStartAt: product.saleStartAt ?? null,
    saleEndAt: product.saleEndAt ?? null,
  }).effectivePriceHuf
}

function formatStockLabel(stock: number): string {
  if (stock === 0) return 'Elfogyott'
  if (stock < 0) return 'Raktáron'
  return `${stock} db`
}

function formatChatPriceLine(
  pricing: ChatProductPricing,
  display?: CustomerMoneyDisplay
): string {
  const current = formatCustomerPrice(pricing.effectivePriceHuf, display)
  if (pricing.isSale) {
    const original = formatCustomerPrice(pricing.normalPriceHuf, display)
    return `Jelenlegi ár: ${current} (Akciós ár! Eredeti ár: ${original})`
  }
  return `Jelenlegi ár: ${current}`
}

/**
 * OpenAI system prompt blokk az aktuális termékoldalról.
 * A tudásbázis magyarul van; az AI a vásárló nyelvén válaszol belőle.
 * Árat a tudásbázisból SOHA ne olvasson – mindig az alábbi éles ár érvényes.
 */
export function buildProductChatContextBlock(
  product: ChatProductContextRow,
  now: Date = new Date(),
  display?: CustomerMoneyDisplay
): string {
  const pricing = resolveChatProductPricing(product, now)
  const knowledge = (product.aiKnowledgeBase ?? '').trim()
  const description = (product.description_hu ?? '').trim()
  const stockLabel = formatStockLabel(product.stock)
  const priceLine = formatChatPriceLine(pricing, display)
  const euroOnly = display ? usesEuroCopy(display.locale) : false

  const knowledgeBlock =
    knowledge ||
    (description ? `Rövid leírás: ${description}` : '(Nincs megadva részletes tudásbázis ehhez a termékhez.)')

  return `
[AKTUÁLIS TERMÉK ÉLES ADATAI]
A vásárló jelenleg ezt a termékoldalt nézi. Az árak az adatbázis éles értékei – NE találj ki és NE használj más árat (még ha a tudásbázisban szerepelne is).
Termék neve: ${product.name}
${priceLine}
Készletállapot: ${stockLabel}
Slug: ${product.slug}

Tudásbázis & Specifikációk (Tulajdonságok):
${knowledgeBlock}

TERMÉK-KONTEXTUS SZABÁLYOK:
1. Mindig a vásárló által használt nyelven válaszolj (lásd a „Válaszolj …” utasítást), akkor is, ha a tudásbázis magyarul van.
2. Árról / akcióról CSAK a fenti „Jelenlegi ár” sort használd – a tudásbázisban lévő esetleges árat hagyd figyelmen kívül.
3. A vásárlónak a fenti megjelenítési árat írd (HU: Ft, egyéb: €). ${euroOnly ? 'NE írj HUF-ot vagy Ft-ot.' : ''}
4. Ha a kérdezett információ szerepel a tudásbázisban / termékadatokban, pontosan arra támaszkodva válaszolj – ne találj ki ellentmondó adatot.
5. Ha olyat kérdeznek, ami NINCS a tudásbázisban és a fenti termékadatokban, ne találj ki adatot; mondd el őszintén, hogy erről nincs biztos információd, és kérj e-mailt vagy irányítsd a termékoldal / ügyfélszolgálat felé.
`.trim()
}

/** Termék lekérése chat kontextushoz (id vagy slug). */
export async function loadChatProductContext(params: {
  productId?: string | null
  productSlug?: string | null
}): Promise<ChatProductContextRow | null> {
  if (!isDbConfigured()) return null

  const select = {
    id: true,
    slug: true,
    name: true,
    priceHuf: true,
    discountPriceHuf: true,
    onSale: true,
    saleStartAt: true,
    saleEndAt: true,
    description_hu: true,
    aiKnowledgeBase: true,
    stock: true,
    active: true,
    archived: true,
  } as const

  const productId = params.productId?.trim()
  if (productId) {
    const byId = await prisma.product.findUnique({
      where: { id: productId },
      select,
    })
    if (byId && byId.active && !byId.archived) return byId
  }

  const slug = params.productSlug?.trim()
  if (!slug) return null

  const candidates = productSlugLookupCandidates(slug)
  for (const candidate of candidates) {
    const bySlug = await prisma.product.findUnique({
      where: { slug: candidate },
      select,
    })
    if (bySlug && bySlug.active && !bySlug.archived) return bySlug
  }
  return null
}
