import { cleanCdnUrl, cleanCdnUrls } from '@/lib/cdn'

/** Teljes képmező-csomag tisztítása (create / teljes replace). */
export function sanitizeProductImageFields(input: {
  image?: string | null
  images?: string[] | null
  images360?: string[] | null
}): { image: string; images: string[]; images360: string[] } {
  const image = cleanCdnUrl(input.image ?? '')
  const images = cleanCdnUrls(input.images)
  const images360 = cleanCdnUrls(input.images360)
  const gallery = images.length ? images : image ? [image] : []
  return { image: image || gallery[0] || '', images: gallery, images360 }
}

/** PATCH: csak a megadott mezőket tisztítja, a többit nem írja felül. */
export function sanitizeProductImagePatch(input: {
  image?: string | null
  images?: string[] | null
  images360?: string[] | null
}): {
  image?: string
  images?: string[]
  images360?: string[]
} {
  const out: { image?: string; images?: string[]; images360?: string[] } = {}
  if (input.image !== undefined) {
    out.image = cleanCdnUrl(input.image ?? '')
  }
  if (input.images !== undefined) {
    out.images = cleanCdnUrls(input.images)
    // Ha galériát mentünk, de nincs külön fő kép a patch-ben, a galéria első eleme legyen a fő
    if (input.image === undefined && out.images[0]) {
      out.image = out.images[0]
    }
  }
  if (input.images360 !== undefined) {
    out.images360 = cleanCdnUrls(input.images360)
  }
  // Ha csak fő kép jön és van érték, galériát ne töröljük itt (a hívó dönt)
  return out
}
