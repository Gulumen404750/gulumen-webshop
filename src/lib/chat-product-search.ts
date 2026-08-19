/**
 * AI chat termékalapú keresés / ajánlás – Prisma (DB-first), mock fallback.
 * A találatokat a chat UI interaktív termékkártyaként jeleníti meg.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { getAllProductsAsync, type Product } from '@/lib/data'
import { resolveChatProductPricing } from '@/lib/chat-product-context'
import type { Locale } from '@/i18n/locales'
import { DEFAULT_LOCALE } from '@/i18n/locales'

export const CHAT_PRODUCT_RECOMMENDATION_LIMIT = 3

export type ChatRecommendedProduct = {
  id: string
  slug: string
  name: string
  priceHuf: number
  discountPriceHuf: number | null
  onSale: boolean
  saleStartAt: Date | string | null
  saleEndAt: Date | string | null
  image: string
  category: string
}

const STOP_WORDS = new Set(
  [
    // HU
    'a',
    'az',
    'egy',
    'és',
    'vagy',
    'van',
    'volt',
    'lesz',
    'hogy',
    'ez',
    'azt',
    'csak',
    'már',
    'még',
    'nem',
    'igen',
    'mi',
    'mit',
    'milyen',
    'hol',
    'hova',
    'mennyi',
    'hány',
    'kell',
    'lenne',
    'szeretnék',
    'szeretnek',
    'szeretném',
    'keresek',
    'keresünk',
    'keresnék',
    'nézek',
    'néznék',
    'mutass',
    'mutasd',
    'mutatnal',
    'mutatnál',
    'ajanl',
    'ajánl',
    'ajanlj',
    'ajánlj',
    'ajanlok',
    'ajánlok',
    'ajanlanek',
    'ajánlanék',
    'javasol',
    'javasolj',
    'javasolnek',
    'javasolnék',
    'kérlek',
    'kérek',
    'valami',
    'valamit',
    'nekem',
    'nekünk',
    'lenne',
    'tudsz',
    'tudna',
    'segítesz',
    'segítség',
    'csinálj',
    'adj',
    'adnál',
    'van-e',
    'vané',
    'lenne-e',
    'kapható',
    'elérhető',
    'webshop',
    'bolt',
    'gulumen',
    'termekeket',
    'termékeket',
    'termekek',
    'termékek',
    'termek',
    'termék',
    // EN
    'the',
    'an',
    'and',
    'or',
    'is',
    'are',
    'was',
    'were',
    'be',
    'to',
    'for',
    'of',
    'in',
    'on',
    'at',
    'do',
    'you',
    'me',
    'my',
    'i',
    'we',
    'have',
    'has',
    'want',
    'need',
    'looking',
    'show',
    'please',
    'some',
    'something',
    'anything',
    'any',
    'can',
    'could',
    'would',
    'like',
    'get',
    'buy',
    'finding',
    'find',
    'about',
    'with',
    'from',
    'recommend',
    'recommendation',
    'product',
    'products',
    // DE
    'der',
    'die',
    'das',
    'ein',
    'eine',
    'und',
    'oder',
    'ich',
    'wir',
    'du',
    'mir',
    'bitte',
    'suche',
    'suchen',
    'möchte',
    'moechte',
    'haben',
    'gibt',
    'etwas',
    'welche',
    'welches',
    'empfehl',
    'empfehle',
    'empfehlen',
    'produkt',
    'produkte',
    // RO
    'un',
    'o',
    'și',
    'si',
    'sau',
    'eu',
    'noi',
    'vreau',
    'caut',
    'te',
    'rog',
    'aveți',
    'aveti',
    'pentru',
    'recomand',
    'recomanzi',
    'produs',
    'produse',
  ].map((w) => w.toLowerCase())
)

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Magyar (és hasonló) ragok levágása, hogy „lámpákat” → „lampa” egyezzen a katalógussal.
 * Leghosszabb illeszkedő végződés először; a tő legalább 3 karakter maradjon.
 */
export function stemSearchToken(token: string): string[] {
  const raw = token.toLowerCase().trim()
  if (raw.length < 3) return raw ? [raw] : []

  const ascii = stripDiacritics(raw)
  const out = new Set<string>([raw, ascii])

  const suffixes = [
    'knak',
    'knek',
    'kat',
    'ket',
    'kot',
    'köt',
    'kat',
    'val',
    'vel',
    'nak',
    'nek',
    'ban',
    'ben',
    'hoz',
    'hez',
    'höz',
    'tol',
    'től',
    'rol',
    'ről',
    'ra',
    're',
    'ba',
    'be',
    'ul',
    'ül',
    'ig',
    'ok',
    'ak',
    'ek',
    'ök',
    'uk',
    'ük',
    'at',
    'et',
    'ot',
    'öt',
    'ut',
    'üt',
    't',
  ]

  for (const base of [ascii, raw]) {
    for (const suffix of suffixes) {
      if (base.endsWith(suffix) && base.length - suffix.length >= 3) {
        const stem = base.slice(0, -suffix.length)
        out.add(stem)
        out.add(stripDiacritics(stem))
      }
    }
  }

  return [...out].filter((t) => t.length >= 3)
}

/** Nem termékkeresés: szállítás / fizetés / panasz stb. */
const NON_PRODUCT_PATTERNS =
  /\b(szállítás|feladás|mikor érkezik|csomag|tracking|shipping|delivery|versand|lieferung|fizetés|fizetni|payment|zahlung|visszaküld|visszatérít|refund|return|rückgabe|panasz|reklamáció|complaint|beschwerde|kártyaszám|cvv|jelszó|password|ügyvéd|lawyer|chargeback|hányadika|hány óra|what time|what date)\b/i

const PRODUCT_INTENT_PATTERNS =
  /\b(ajánlj|ajánl|javasol|recommend|empfehl|mit vegyek|what to buy|keresek|keresünk|nézek|looking for|suche|caut|lámpa|lámpát|lámpák|lámpákat|taska|táska|táskát|bag|lampe|lamp|produk|termék|product|ajándék|gift|geschenk|otthon|home|konyha|kitchen|küche|nappali|íróasztal|gyerek|dekor|deco|állvány|tartó|szervező|organiz|virág|növény|macska|kutya|óra|óraállvány|telefon|töltő|cable|kábel)\b/i

export function isProductSearchQuery(message: string): boolean {
  const msg = message.trim()
  if (msg.length < 2) return false
  if (
    /\b(köszönöm|thanks|thank you|danke|tschüss|bye|viszontlátásra|szia|hello|helló)\b/i.test(
      msg
    ) &&
    !PRODUCT_INTENT_PATTERNS.test(msg)
  ) {
    return false
  }
  if (NON_PRODUCT_PATTERNS.test(msg) && !PRODUCT_INTENT_PATTERNS.test(msg)) {
    return false
  }
  if (PRODUCT_INTENT_PATTERNS.test(msg)) return true
  // Van legalább egy értelmes kulcsszó (nem stop word) – pl. „asztali óra”
  return extractSearchKeywords(msg).length > 0
}

function isStopWord(token: string): boolean {
  const lower = token.toLowerCase()
  if (STOP_WORDS.has(lower)) return true
  return STOP_WORDS.has(stripDiacritics(lower))
}

/** Kulcsszavak kinyerése a felhasználói üzenetből (ragozott alakok töveivel együtt). */
export function extractSearchKeywords(message: string): string[] {
  const normalized = stripDiacritics(message.toLowerCase()).replace(/[^a-z0-9\s-]/gi, ' ')

  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !isStopWord(t))

  // Eredeti (ékezetes) tokenek is – DB-ben gyakran ékezetes név van
  const originalTokens = message
    .toLowerCase()
    .replace(/[^a-záéíóöőúüűäößșțăâî0-9\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !isStopWord(t))

  const expanded: string[] = []
  for (const token of [...originalTokens, ...tokens]) {
    for (const stem of stemSearchToken(token)) {
      if (!isStopWord(stem)) expanded.push(stem)
    }
  }

  const merged = [...new Set(expanded)]
  // Prefer shorter stems first for DB contains matching (lampa before lampakat)
  merged.sort((a, b) => a.length - b.length || a.localeCompare(b))
  return merged.slice(0, 12)
}

function scoreHaystack(haystack: string, keywords: string[]): number {
  if (!haystack.trim() || keywords.length === 0) return 0
  const hay = haystack.toLowerCase()
  const asciiHay = stripDiacritics(hay)
  let score = 0
  for (const kw of keywords) {
    const variants = stemSearchToken(kw)
    let best = 0
    for (const variant of variants) {
      const asciiKw = stripDiacritics(variant)
      if (hay.includes(variant) || asciiHay.includes(asciiKw)) {
        best = Math.max(best, variant.length >= 5 ? 3 : 2)
        continue
      }
      // Részleges: „lamp” ↔ „lampa”, „asztal” ↔ „asztali”.
      // Szigorú hossz: „lamp” ne illeszkedjen „laptop” táskára.
      if (asciiKw.length >= 4) {
        const hayWords = asciiHay.split(/[^a-z0-9]+/).filter(Boolean)
        for (const word of hayWords) {
          if (word.startsWith(asciiKw) || asciiKw.startsWith(word)) {
            const longer = Math.max(word.length, asciiKw.length)
            const shorter = Math.min(word.length, asciiKw.length)
            if (longer - shorter <= 1) {
              best = Math.max(best, 2)
            }
          }
        }
      }
    }
    score += best
  }
  return score
}

export function scoreProductFields(
  product: Pick<ChatRecommendedProduct, 'name' | 'slug' | 'category'> & {
    description?: string | null
    nameEn?: string | null
    nameDe?: string | null
    nameRo?: string | null
  },
  keywords: string[]
): { nameScore: number; descScore: number; total: number } {
  const nameHay = [
    product.name,
    product.nameEn,
    product.nameDe,
    product.nameRo,
    product.slug,
    product.category,
  ]
    .filter(Boolean)
    .join(' ')
  const nameScore = scoreHaystack(nameHay, keywords)
  const descScore = scoreHaystack(product.description ?? '', keywords)
  return { nameScore, descScore, total: nameScore * 3 + descScore }
}

export function scoreProductAgainstKeywords(
  product: Pick<ChatRecommendedProduct, 'name' | 'slug' | 'category'> & {
    description?: string | null
    nameEn?: string | null
    nameDe?: string | null
    nameRo?: string | null
  },
  keywords: string[]
): number {
  const { nameScore, descScore } = scoreProductFields(product, keywords)
  return nameScore + descScore
}

function pickNamedKeywordHits<T extends { nameScore: number; total: number }>(
  scored: T[],
  limit: number
): T[] {
  const named = scored.filter((x) => x.nameScore > 0).sort((a, b) => b.total - a.total)
  if (named.length === 0) return []
  const top = named[0].total
  const minKeep = Math.max(2, Math.floor(top * 0.5))
  return named.filter((x) => x.total >= minKeep).slice(0, limit)
}

function localizedCatalogName(
  row: {
    name: string
    nameEn?: string | null
    nameDe?: string | null
    nameRo?: string | null
    slug?: string
    id?: string
  },
  locale: Locale
): string {
  const fallback = row.name?.trim() || row.slug || row.id || ''
  if (locale === 'en') return (row.nameEn || row.name || fallback).trim()
  if (locale === 'de') return (row.nameDe || row.nameEn || row.name || fallback).trim()
  if (locale === 'ro') return (row.nameRo || row.nameEn || row.name || fallback).trim()
  return (row.name || fallback).trim()
}

const productSelect = {
  id: true,
  slug: true,
  name: true,
  nameEn: true,
  nameDe: true,
  nameRo: true,
  priceHuf: true,
  discountPriceHuf: true,
  onSale: true,
  saleStartAt: true,
  saleEndAt: true,
  image: true,
  category: true,
} as const

function mapDbRowToRecommended(
  row: {
    id: string
    slug: string
    name: string
    nameEn?: string | null
    nameDe?: string | null
    nameRo?: string | null
    priceHuf: number
    discountPriceHuf: number | null
    onSale: boolean
    saleStartAt: Date | null
    saleEndAt: Date | null
    image: string
    category: string
  },
  locale: Locale
): ChatRecommendedProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: localizedCatalogName(row, locale),
    priceHuf: row.priceHuf,
    discountPriceHuf: row.discountPriceHuf,
    onSale: row.onSale,
    saleStartAt: row.saleStartAt,
    saleEndAt: row.saleEndAt,
    image: row.image,
    category: row.category,
  }
}

function mapProductToRecommended(p: Product, locale: Locale): ChatRecommendedProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: localizedCatalogName(p, locale),
    priceHuf: p.priceHuf,
    discountPriceHuf: p.discountPriceHuf ?? null,
    onSale: !!p.onSale,
    saleStartAt: p.saleStartAt ?? null,
    saleEndAt: p.saleEndAt ?? null,
    image: p.image,
    category: p.category,
  }
}

async function searchProductsInDb(
  keywords: string[],
  limit: number,
  excludeProductIds: string[] = [],
  locale: Locale = DEFAULT_LOCALE
): Promise<ChatRecommendedProduct[]> {
  if (!isDbConfigured()) return []
  const blocked = excludeProductIds.filter(Boolean)
  const notIn = blocked.length > 0 ? { id: { notIn: blocked } } : {}

  if (keywords.length === 0) {
    const rows = await prisma.product.findMany({
      where: { active: true, archived: false, ...notIn },
      orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
      take: limit + blocked.length,
      select: productSelect,
    })
    return rows.map((row) => mapDbRowToRecommended(row, locale)).slice(0, limit)
  }

  const dbKeywords = [...new Set(keywords.flatMap((kw) => stemSearchToken(kw)))].slice(0, 24)

  const orFilters = dbKeywords.flatMap((kw) => [
    { name: { contains: kw, mode: 'insensitive' as const } },
    { nameEn: { contains: kw, mode: 'insensitive' as const } },
    { nameDe: { contains: kw, mode: 'insensitive' as const } },
    { nameRo: { contains: kw, mode: 'insensitive' as const } },
    { slug: { contains: kw, mode: 'insensitive' as const } },
    { category: { contains: kw, mode: 'insensitive' as const } },
    { description_hu: { contains: kw, mode: 'insensitive' as const } },
    { description_en: { contains: kw, mode: 'insensitive' as const } },
  ])

  const rows = await prisma.product.findMany({
    where: {
      active: true,
      archived: false,
      ...notIn,
      OR: orFilters,
    },
    orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(limit * 4, 12),
    select: {
      ...productSelect,
      description_hu: true,
    },
  })

  const toScored = (
    row: (typeof rows)[number]
  ): { product: ChatRecommendedProduct; nameScore: number; total: number } => {
    const fields = scoreProductFields(
      { ...row, description: row.description_hu },
      keywords
    )
    return {
      product: mapDbRowToRecommended(row, locale),
      nameScore: fields.nameScore,
      total: fields.total,
    }
  }

  let scored = rows.map(toScored)
  let picked = pickNamedKeywordHits(scored, limit)

  // Ékezet / ragozás miatt a SQL contains gyakran 0 sort ad (lámpa vs lampa).
  // Ilyenkor népszerű poolon JS-ben pontozunk ascii-tűrően, de CSAK név/slug/kategória egyezés.
  if (picked.length === 0) {
    const pool = await prisma.product.findMany({
      where: { active: true, archived: false, ...notIn },
      orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
      take: 120,
      select: {
        ...productSelect,
        description_hu: true,
      },
    })
    scored = pool.map(toScored)
    picked = pickNamedKeywordHits(scored, limit)
  }

  return picked.map((x) => x.product)
}

async function searchProductsInMemory(
  keywords: string[],
  limit: number,
  excludeProductIds: string[] = [],
  locale: Locale = DEFAULT_LOCALE
): Promise<ChatRecommendedProduct[]> {
  const all = await getAllProductsAsync()
  const blocked = new Set(excludeProductIds)
  const active = all.filter(
    (p) => p.active !== false && p.archived !== true && !blocked.has(p.id)
  )

  if (keywords.length === 0) {
    return active
      .slice()
      .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
      .slice(0, limit)
      .map((p) => mapProductToRecommended(p, locale))
  }

  const scored = active.map((p) => {
    const fields = scoreProductFields(
      {
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        slug: p.slug,
        category: p.category,
        description: p.description_hu ?? p.description,
      },
      keywords
    )
    return {
      product: mapProductToRecommended(p, locale),
      nameScore: fields.nameScore,
      total: fields.total,
    }
  })

  return pickNamedKeywordHits(scored, limit).map((x) => x.product)
}

export type ChatProductMatchKind = 'keyword' | 'catalog_browse' | 'alternatives' | 'none'

export type ChatProductSearchResult = {
  products: ChatRecommendedProduct[]
  matchKind: ChatProductMatchKind
  /** Konkrét termékkeresés, de nincs kulcsszavas találat a katalógusban. */
  missingExactMatch: boolean
}

const GENERIC_INTENT_TOKEN =
  /^(ajanl|javasol|recommend|empfehl|gift|ajandek|geschenk|home|otthon|unnep|szuletesnap|nevnap|vegyek|vegyel|venni|vennem|buy|kaufen|cumpar)$/i

const GENERIC_INTENT_STEMS = [
  'ajandek',
  'geschenk',
  'recommend',
  'empfehl',
  'szuletesnap',
  'nevnap',
  'vegyek',
  'venni',
] as const

function isGenericIntentKeyword(token: string): boolean {
  const ascii = stripDiacritics(token.toLowerCase())
  if (GENERIC_INTENT_TOKEN.test(ascii)) return true
  return GENERIC_INTENT_STEMS.some(
    (stem) =>
      ascii.length >= 4 &&
      stem.length >= 4 &&
      (ascii.startsWith(stem) || stem.startsWith(ascii))
  )
}

function emptySearchResult(): ChatProductSearchResult {
  return { products: [], matchKind: 'none', missingExactMatch: false }
}

/** Konkrét terméknév/kategória vs. általános „ajánlj valamit / ajándék”. */
export function resolveChatProductSearchIntent(message: string): {
  isProductSearch: boolean
  specificKeywords: string[]
  recommendOnly: boolean
} {
  const isProductSearch = isProductSearchQuery(message)
  if (!isProductSearch) {
    return { isProductSearch: false, specificKeywords: [], recommendOnly: false }
  }
  const keywords = extractSearchKeywords(message)
  const specificKeywords = keywords.filter((k) => !isGenericIntentKeyword(k))
  return {
    isProductSearch: true,
    specificKeywords,
    recommendOnly: specificKeywords.length === 0,
  }
}

function resultFromHits(
  hits: ChatRecommendedProduct[],
  recommendOnly: boolean
): ChatProductSearchResult {
  if (recommendOnly) {
    return {
      products: hits,
      matchKind: hits.length > 0 ? 'catalog_browse' : 'none',
      missingExactMatch: false,
    }
  }
  if (hits.length > 0) {
    return { products: hits, matchKind: 'keyword', missingExactMatch: false }
  }
  return { products: [], matchKind: 'none', missingExactMatch: true }
}

/**
 * Releváns termékek keresése a chat üzenet alapján (max 2–3).
 * Konkrét keresésnél NEM töltjük fel idegen népszerű termékekkel a listát:
 * ha nincs kulcsszavas találat, a találat hiánycikk, a népszerű darabok csak
 * külön jelölt ALTERNATÍVÁK lehetnek.
 */
export async function searchProductsForChat(
  message: string,
  options: { limit?: number; excludeProductIds?: string[]; locale?: Locale } = {}
): Promise<ChatProductSearchResult> {
  const take = Math.min(
    Math.max(options.limit ?? CHAT_PRODUCT_RECOMMENDATION_LIMIT, 1),
    CHAT_PRODUCT_RECOMMENDATION_LIMIT
  )
  const excludeProductIds = options.excludeProductIds ?? []
  const locale = options.locale ?? DEFAULT_LOCALE
  const intent = resolveChatProductSearchIntent(message)
  if (!intent.isProductSearch) return emptySearchResult()

  const searchKeywords = intent.recommendOnly ? [] : intent.specificKeywords

  try {
    if (isDbConfigured()) {
      const dbHits = await searchProductsInDb(searchKeywords, take, excludeProductIds, locale)
      const primary = resultFromHits(dbHits, intent.recommendOnly)
      if (!primary.missingExactMatch) return primary
      const popular = await searchProductsInDb([], take, excludeProductIds, locale)
      return {
        products: popular,
        matchKind: popular.length > 0 ? 'alternatives' : 'none',
        missingExactMatch: true,
      }
    }
  } catch {
    // fallback memóriára
  }

  const memoryHits = await searchProductsInMemory(searchKeywords, take, excludeProductIds, locale)
  const primary = resultFromHits(memoryHits, intent.recommendOnly)
  if (!primary.missingExactMatch) return primary
  const popularMemory = await searchProductsInMemory([], take, excludeProductIds, locale)
  return {
    products: popularMemory,
    matchKind: popularMemory.length > 0 ? 'alternatives' : 'none',
    missingExactMatch: true,
  }
}

function formatProductLines(
  products: ChatRecommendedProduct[],
  now: Date
): string {
  return products
    .map((p, i) => {
      const pricing = resolveChatProductPricing(
        {
          priceHuf: p.priceHuf,
          discountPriceHuf: p.discountPriceHuf,
          onSale: p.onSale,
          saleStartAt: p.saleStartAt,
          saleEndAt: p.saleEndAt,
        },
        now
      )
      const priceLabel = pricing.isSale
        ? `${pricing.effectivePriceHuf.toLocaleString('hu-HU')} Ft (akciós; eredeti: ${pricing.normalPriceHuf.toLocaleString('hu-HU')} Ft)`
        : `${pricing.effectivePriceHuf.toLocaleString('hu-HU')} Ft`
      return `${i + 1}. ${p.name} – ${priceLabel} – kategória: ${p.category} – link: /termek/${p.slug} (id: ${p.id})`
    })
    .join('\n')
}

export type RecommendedProductsBlockOptions = {
  matchKind?: ChatProductMatchKind
  missingExactMatch?: boolean
  now?: Date
}

function buildMissingProductChatBlock(products: ChatRecommendedProduct[], now: Date): string {
  if (products.length === 0) {
    return `
[NINCS PONTOS TERMÉKTALÁLAT]
A vásárló konkrét terméket keresett, de a katalógusban NINCS egyezés, és alternatívát sem adunk.
KÖTELEZŐ a vásárló nyelvén (lásd LANGUAGE LOCK):
- Mondd ki világosan: sajnos pontosan ilyen termék most nincs a kínálatunkban.
- TILOS kitalált terméknevet, árat, készletet vagy hamis találatot állítani.
- Ne állítsd, hogy megtaláltad a kért árucikket.
- Tereld a /termekek böngészéshez, vagy tegyél fel max. 1 célzott kérdést (szín, helyiség).
`.trim()
  }

  const lines = formatProductLines(products, now)
  return `
[NINCS PONTOS TERMÉKTALÁLAT — ALTERNATÍVÁK]
A vásárló konkrét terméket keresett, de PONTOS EGYEZÉS NINCS a katalógusban.
Az alábbi ${products.length} darab NEM a kért termék – csak Hozzá illő / helyettesítő ötlet.
A válaszod ALATT a chat felületen AUTOMATIKUSAN megjelennek a termékkártyák ezekhez.

KÖTELEZŐ a vásárló nyelvén (lásd LANGUAGE LOCK):
- Először mondd ki: sajnos pontosan ilyen terméket most nem találtál a kínálatunkban.
- Csak ezután ajánld a listát, és KÖTELEZŐEN jelezd, hogy ezek ALTERNATÍVÁK / hozzá illő termékek, mert a keresett árucikk jelenleg nem elérhető.
- NE állítsd be úgy, mintha ezek lennének, amit a vásárló eredetileg kért.
- Pontosan ezt a ${products.length} terméket említsd, a KATALÓGUSBELI PONTOS NÉVVEL.
- Ne találj ki más nevet (pl. „kényelmes párna”, „otthoni dekoráció” tilos, ha nincs ilyen a listában).
- A számozott listád hossza = ${products.length}. Minden tétel ÚJ SORON, 2–4 barátságos emojival.

${lines}
`.trim()
}

/** OpenAI system prompt blokk a találatokhoz – az AI szövegesen is hivatkozhasson rájuk. */
export function buildRecommendedProductsChatBlock(
  products: ChatRecommendedProduct[],
  options: RecommendedProductsBlockOptions = {}
): string {
  const matchKind = options.matchKind ?? 'keyword'
  const missingExactMatch = options.missingExactMatch ?? matchKind === 'alternatives'
  const now = options.now ?? new Date()

  if (missingExactMatch || matchKind === 'alternatives') {
    return buildMissingProductChatBlock(products, now)
  }

  if (products.length === 0) return ''

  const lines = formatProductLines(products, now)
  const browseNote =
    matchKind === 'catalog_browse'
      ? 'Ezek népszerű / általános ötletek (nem egy konkrét cikkszám keresése).'
      : `A katalógusból ezek a releváns termékek jöttek ki (${products.length} db).`

  return `
[AJÁNLOTT TERMÉKEK A VÁSÁRLÓ KERESÉSÉHEZ]
${browseNote} A válaszod ALATT a chat felületen AUTOMATIKUSAN megjelennek az interaktív termékkártyák MINDEN lentebb listázott termékhez.
SOHA ne mondd, hogy „nem tudok termékeket mutatni”.
KÖTELEZŐ:
- Pontosan ezt a ${products.length} terméket említsd meg, a KATALÓGUSBELI PONTOS NÉVVEL (ahogy alább szerepel).
- Ne találj ki más nevet (pl. „kényelmes párna”, „otthoni dekoráció” tilos, ha nincs ilyen a listában).
- A számozott listád hossza = ${products.length} (minden ajánlott termékhez egy tétel és egy kártya).
- Minden tétel ÚJ SORON, üres sorral elválasztva, 2–4 barátságos emojival (🎁 ✨ 🏠 💚).

Példa (a köszöntést a LANGUAGE LOCK nyelvén írd, ne magyarul, ha a locale nem hu):

Hello! 🎁 Here are ${products.length} ideas:

1. ✨ [1. termék pontos neve a listából] – rövid indok.

2. 🏠 [2. termék pontos neve a listából] – rövid indok.
${products.length >= 3 ? '\n3. 💚 [3. termék pontos neve a listából] – rövid indok.\n' : ''}
Melyik tetszik?

${lines}
`.trim()
}
