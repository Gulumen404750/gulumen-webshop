/**
 * AI chat termékalapú keresés / ajánlás – Prisma (DB-first), mock fallback.
 * A találatokat a chat UI interaktív termékkártyaként jeleníti meg.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { getAllProductsAsync, type Product } from '@/lib/data'
import { resolveChatProductPricing } from '@/lib/chat-product-context'

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
  /\b(ajánl|javasol|recommend|empfehl|mit vegyek|what to buy|keresek|keresünk|nézek|looking for|suche|caut|lámpa|lámpát|lámpák|lámpákat|taska|táska|táskát|bag|lampe|lamp|produk|termék|product|ajándék|gift|geschenk|otthon|home|konyha|kitchen|küche|nappali|íróasztal|gyerek|dekor|deco|állvány|tartó|szervező|organiz|virág|növény|macska|kutya|óra|óraállvány|telefon|töltő|cable|kábel)\b/i

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

function scoreProductAgainstKeywords(
  product: Pick<ChatRecommendedProduct, 'name' | 'slug' | 'category'> & {
    description?: string | null
  },
  keywords: string[]
): number {
  if (keywords.length === 0) return 0
  const hay = `${product.name} ${product.slug} ${product.category} ${product.description ?? ''}`.toLowerCase()
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
      // Részleges: „lamp” ↔ „lampa”, „asztal” ↔ „asztali”
      if (asciiKw.length >= 4) {
        const hayWords = asciiHay.split(/[^a-z0-9]+/).filter(Boolean)
        for (const word of hayWords) {
          if (word.startsWith(asciiKw) || asciiKw.startsWith(word)) {
            best = Math.max(best, 2)
          }
        }
      }
    }
    score += best
  }
  return score
}

const productSelect = {
  id: true,
  slug: true,
  name: true,
  priceHuf: true,
  discountPriceHuf: true,
  onSale: true,
  saleStartAt: true,
  saleEndAt: true,
  image: true,
  category: true,
} as const

function mapDbRowToRecommended(row: {
  id: string
  slug: string
  name: string
  priceHuf: number
  discountPriceHuf: number | null
  onSale: boolean
  saleStartAt: Date | null
  saleEndAt: Date | null
  image: string
  category: string
}): ChatRecommendedProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceHuf: row.priceHuf,
    discountPriceHuf: row.discountPriceHuf,
    onSale: row.onSale,
    saleStartAt: row.saleStartAt,
    saleEndAt: row.saleEndAt,
    image: row.image,
    category: row.category,
  }
}

function mapProductToRecommended(p: Product): ChatRecommendedProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
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
  limit: number
): Promise<ChatRecommendedProduct[]> {
  if (!isDbConfigured()) return []

  if (keywords.length === 0) {
    const rows = await prisma.product.findMany({
      where: { active: true, archived: false },
      orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: productSelect,
    })
    return rows.map(mapDbRowToRecommended)
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
      OR: orFilters,
    },
    orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(limit * 4, 12),
    select: {
      ...productSelect,
      description_hu: true,
    },
  })

  let scored = rows
    .map((row) => ({
      product: mapDbRowToRecommended(row),
      score: scoreProductAgainstKeywords(
        { ...row, description: row.description_hu },
        keywords
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  // Ékezet / ragozás miatt a SQL contains gyakran 0 sort ad (lámpa vs lampa).
  // Ilyenkor népszerű poolon JS-ben pontozunk ascii-tűrően.
  if (scored.length === 0) {
    const pool = await prisma.product.findMany({
      where: { active: true, archived: false },
      orderBy: [{ likesCount: 'desc' }, { updatedAt: 'desc' }],
      take: 120,
      select: {
        ...productSelect,
        description_hu: true,
      },
    })
    scored = pool
      .map((row) => ({
        product: mapDbRowToRecommended(row),
        score: scoreProductAgainstKeywords(
          { ...row, description: row.description_hu },
          keywords
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
  }

  return scored.slice(0, limit).map((x) => x.product)
}

async function searchProductsInMemory(
  keywords: string[],
  limit: number
): Promise<ChatRecommendedProduct[]> {
  const all = await getAllProductsAsync()
  const active = all.filter((p) => p.active !== false && p.archived !== true)

  if (keywords.length === 0) {
    return active
      .slice()
      .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
      .slice(0, limit)
      .map(mapProductToRecommended)
  }

  const scored = active
    .map((p) => ({
      product: mapProductToRecommended(p),
      score: scoreProductAgainstKeywords(
        {
          name: `${p.name} ${p.nameEn ?? ''} ${p.nameDe ?? ''} ${p.nameRo ?? ''}`,
          slug: p.slug,
          category: p.category,
          description: p.description_hu ?? p.description,
        },
        keywords
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((x) => x.product)
}

/**
 * Releváns termékek keresése a chat üzenet alapján (max 2–3).
 * Üres lista, ha nem termékkeresés / nincs találat.
 */
export async function searchProductsForChat(
  message: string,
  limit: number = CHAT_PRODUCT_RECOMMENDATION_LIMIT
): Promise<ChatRecommendedProduct[]> {
  const take = Math.min(Math.max(limit, 1), CHAT_PRODUCT_RECOMMENDATION_LIMIT)
  if (!isProductSearchQuery(message)) return []

  const keywords = extractSearchKeywords(message)
  const giftIntent =
    /\b(ajándék|ajandek|gift|geschenk|születésnap|szuletesnap|ünnep|unnep|névnap|nevnap)\b/i.test(
      message
    )
  const vagueRecommendIntent =
    /\b(ajánl|javasol|recommend|empfehl|mit vegyek|what to buy)\b/i.test(message) &&
    keywords.every((k) =>
      /^(ajanl|javasol|recommend|empfehl|gift|ajandek|home|otthon)$/i.test(stripDiacritics(k))
    )
  const recommendOnly = keywords.length === 0 || vagueRecommendIntent || giftIntent

  try {
    if (isDbConfigured()) {
      const dbHits = await searchProductsInDb(recommendOnly ? [] : keywords, take)
      if (dbHits.length > 0) return dbHits
      // Termékintent + üres találat: ne hagyjuk kártyák nélkül – népszerű darabok
      const popular = await searchProductsInDb([], take)
      if (popular.length > 0) return popular
    }
  } catch {
    // fallback memóriára
  }

  const memoryHits = await searchProductsInMemory(recommendOnly ? [] : keywords, take)
  if (memoryHits.length > 0) return memoryHits
  return searchProductsInMemory([], take)
}

/** OpenAI system prompt blokk a találatokhoz – az AI szövegesen is hivatkozhasson rájuk. */
export function buildRecommendedProductsChatBlock(
  products: ChatRecommendedProduct[],
  now: Date = new Date()
): string {
  if (products.length === 0) return ''

  const lines = products.map((p, i) => {
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

  return `
[AJÁNLOTT TERMÉKEK A VÁSÁRLÓ KERESÉSÉHEZ]
A katalógusból ezek a releváns termékek jöttek ki. A válaszod ALATT a chat felületen AUTOMATIKUSAN megjelennek az interaktív termékkártyák (kép, név, ár, kattintható link).
SOHA ne mondd, hogy „nem tudok termékeket mutatni”, „itt nem tudok listázni”, vagy hogy csak szövegesen tudsz segíteni – a kártyák a te válaszod mellett megjelennek.
Említsd meg röviden ezeket (vagy a legjobban illőket) név szerint, NE találj ki más terméket vagy árat.
KÖTELEZŐ FORMÁTUM: minden tétel ÚJ SORON, üres sorral elválasztva, 2–4 barátságos emojival (🎁 ✨ 🏠 💚). Példa:

Szia! 🎁 Íme három ötlet:

1. ✨ Terméknév – egy rövid indok.

2. 🏠 Terméknév – egy rövid indok.

3. 💚 Terméknév – egy rövid indok.

Melyik tetszik?

Ha egyik sem illik pontosan, mondd el őszintén, és kérdezz rá finoman, mire keres pontosan.

${lines.join('\n')}
`.trim()
}
