/**
 * Termékkép mezők: külső http(s) URL-ek letöltése és saját CDN URL-re cseréje mentéskor.
 */
import { sanitizeColorImages } from '@/lib/product-images'
import {
  ingestRemoteImageUrl,
  shouldIngestRemoteImageUrl,
  RemoteImageIngestError,
} from '@/lib/ingest-remote-image'

export const MAX_REMOTE_IMAGES_PER_SAVE = 40
const INGEST_CONCURRENCY = 3

export type ProductImageIngestInput = {
  slug: string
  image?: string
  images?: string[]
  images360?: string[]
  colorImages?: unknown
}

export type ProductImageIngestResult = {
  image?: string
  images?: string[]
  images360?: string[]
  colorImages?: unknown
  ingestedCount: number
}

export type IngestUrlFn = (url: string, ctx: { slug: string }) => Promise<string>

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return []
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next
      next += 1
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  const n = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

function collectStrings(value: unknown, acc: string[]) {
  if (typeof value === 'string') {
    acc.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, acc)
    }
  }
}

function rewriteStrings(value: unknown, map: Map<string, string>): unknown {
  if (typeof value === 'string') return map.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => rewriteStrings(item, map))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteStrings(item, map)
    }
    return out
  }
  return value
}

export async function ingestProductImages(
  input: ProductImageIngestInput,
  ingestUrl: IngestUrlFn = (url, ctx) => ingestRemoteImageUrl(url, { slug: ctx.slug })
): Promise<ProductImageIngestResult> {
  const candidates: string[] = []
  if (input.image !== undefined) candidates.push(input.image)
  if (input.images) candidates.push(...input.images)
  if (input.images360) candidates.push(...input.images360)
  if (input.colorImages !== undefined && input.colorImages !== null) {
    collectStrings(input.colorImages, candidates)
  }

  const uniqueRemote = [...new Set(candidates.filter(shouldIngestRemoteImageUrl))]
  if (uniqueRemote.length > MAX_REMOTE_IMAGES_PER_SAVE) {
    throw new RemoteImageIngestError(
      `Egyszerre legfeljebb ${MAX_REMOTE_IMAGES_PER_SAVE} külső kép tölthető le. Csökkentsd a galéria méretét, vagy töltsd fel a képeket fájlként.`,
      'too_large'
    )
  }

  const replacements = new Map<string, string>()
  if (uniqueRemote.length > 0) {
    await mapPool(uniqueRemote, INGEST_CONCURRENCY, async (url) => {
      const stored = await ingestUrl(url, { slug: input.slug })
      replacements.set(url, stored)
      return stored
    })
  }

  const rewrite = <T,>(value: T | undefined): T | undefined => {
    if (value === undefined) return undefined
    return rewriteStrings(value, replacements) as T
  }

  const colorImages =
    input.colorImages === undefined
      ? undefined
      : (sanitizeColorImages(rewrite(input.colorImages)) as unknown)

  return {
    image: rewrite(input.image),
    images: rewrite(input.images),
    images360: rewrite(input.images360),
    colorImages,
    ingestedCount: replacements.size,
  }
}
