/**
 * Storefront chat: aktuális termék kontextus az OpenAI system message-hez.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { productSlugLookupCandidates } from '@/lib/slug'

/** Termékoldal slug a pathname-ből: /termek/[slug] */
export function extractProductSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(/^\/termek\/([^/?#]+)/)
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
  description_hu: string | null
  aiKnowledgeBase: string | null
  stock: number
  active: boolean
  archived: boolean
}

/** Effektív megjelenítendő ár (Ft) – ha van kedvezményes ár, azt használjuk. */
export function resolveChatProductPriceHuf(product: {
  priceHuf: number
  discountPriceHuf?: number | null
}): number {
  if (
    typeof product.discountPriceHuf === 'number' &&
    product.discountPriceHuf > 0 &&
    product.discountPriceHuf < product.priceHuf
  ) {
    return product.discountPriceHuf
  }
  return product.priceHuf
}

/**
 * OpenAI system prompt blokk az aktuális termékoldalról.
 * A tudásbázis magyarul van; az AI a vásárló nyelvén válaszol belőle.
 */
export function buildProductChatContextBlock(product: ChatProductContextRow): string {
  const price = resolveChatProductPriceHuf(product)
  const knowledge = (product.aiKnowledgeBase ?? '').trim()
  const description = (product.description_hu ?? '').trim()
  const stockLabel =
    product.stock === 0
      ? 'Elfogyott'
      : product.stock < 0
        ? 'Készleten'
        : `${product.stock} db`

  const detailsParts = [
    knowledge ? knowledge : null,
    !knowledge && description ? `Rövid leírás: ${description}` : null,
  ].filter(Boolean)

  const details = detailsParts.join('\n\n') || '(Nincs megadva részletes tudásbázis ehhez a termékhez.)'

  return `
[AKTUÁLIS TERMÉK INFORMÁCIÓI]
A vásárló jelenleg ezt a termékoldalt nézi. Használd az alábbi adatokat, ha a kérdés erre a termékre vonatkozik.
Név: ${product.name}
Ár: ${price.toLocaleString('hu-HU')} Ft
Készlet: ${stockLabel}
Slug: ${product.slug}
Tudásbázis & Részletek: ${details}

TERMÉK-KONTEXTUS SZABÁLYOK:
1. Mindig a vásárló által használt nyelven válaszolj (lásd a „Válaszolj …” utasítást), akkor is, ha a tudásbázis magyarul van.
2. Ha a kérdezett információ szerepel a tudásbázisban / termékadatokban, pontosan arra támaszkodva válaszolj – ne találj ki ellentmondó adatot.
3. Ha olyat kérdeznek, ami NINCS a tudásbázisban és a fenti termékadatokban, ne találj ki adatot; mondd el őszintén, hogy erről nincs biztos információd, és kérj e-mailt vagy irányítsd a termékoldal / ügyfélszolgálat felé.
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
