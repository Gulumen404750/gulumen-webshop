/**
 * Filament színek a 3D nyomtatott termékekhez + dinamikus színvariációk.
 */

import { normalizeImageUrls } from '@/lib/product-images'

export type FilamentColor = {
  id: string
  name: string
  nameEn?: string
  nameDe?: string
  nameRo?: string
  hex: string
}

/** Adminban / shopban használt színvariáció (név + HEX + képek). */
export type ColorVariant = {
  id: string
  name: string
  nameEn?: string
  nameDe?: string
  nameRo?: string
  hex: string
  images: string[]
}

/** Színenkénti termékfotók: color id → kép URL-ek (legacy + belső map). */
export type ColorImagesMap = Record<string, string[]>

export const FILAMENT_COLORS: FilamentColor[] = [
  { id: 'white', name: 'Fehér', nameEn: 'White', nameDe: 'Weiß', nameRo: 'Alb', hex: '#FFFFFF' },
  { id: 'black', name: 'Fekete', nameEn: 'Black', nameDe: 'Schwarz', nameRo: 'Negru', hex: '#1a1a1a' },
  { id: 'red', name: 'Piros', nameEn: 'Red', nameDe: 'Rot', nameRo: 'Roșu', hex: '#c41e3a' },
  { id: 'blue', name: 'Kék', nameEn: 'Blue', nameDe: 'Blau', nameRo: 'Albastru', hex: '#2563eb' },
  { id: 'green', name: 'Zöld', nameEn: 'Green', nameDe: 'Grün', nameRo: 'Verde', hex: '#16a34a' },
  { id: 'grey', name: 'Szürke', nameEn: 'Grey', nameDe: 'Grau', nameRo: 'Gri', hex: '#6b7280' },
  { id: 'yellow', name: 'Sárga', nameEn: 'Yellow', nameDe: 'Gelb', nameRo: 'Galben', hex: '#eab308' },
  { id: 'gold', name: 'Arany', nameEn: 'Gold', nameDe: 'Gold', nameRo: 'Auriu', hex: '#d4af37' },
  { id: 'brown', name: 'Barna', nameEn: 'Brown', nameDe: 'Braun', nameRo: 'Maro', hex: '#8b4513' },
  { id: 'wood', name: 'Fámintázat', nameEn: 'Wood', nameDe: 'Holzoptik', nameRo: 'Nuanță lemn', hex: '#c4a574' },
  { id: 'stone', name: 'Kőmintázat', nameEn: 'Stone', nameDe: 'Steinoptik', nameRo: 'Nuanță piatră', hex: '#9e9e9e' },
  { id: 'neon-pink', name: 'Neon rózsaszín', nameEn: 'Neon pink', nameDe: 'Neonrosa', nameRo: 'Roz neon', hex: '#ff6ec7' },
  { id: 'neon-green', name: 'Neon zöld', nameEn: 'Neon green', nameDe: 'Neongrün', nameRo: 'Verde neon', hex: '#39ff14' },
  { id: 'neon-blue', name: 'Neon kék', nameEn: 'Neon blue', nameDe: 'Neonblau', nameRo: 'Albastru neon', hex: '#00d4ff' },
  { id: 'neon-yellow', name: 'Neon sárga', nameEn: 'Neon yellow', nameDe: 'Neongelb', nameRo: 'Galben neon', hex: '#ccff00' },
  { id: 'neon-orange', name: 'Neon narancs', nameEn: 'Neon orange', nameDe: 'Neonorange', nameRo: 'Portocaliu neon', hex: '#ff6600' },
]

export function getFilamentColorById(id: string): FilamentColor | undefined {
  return FILAMENT_COLORS.find((c) => c.id === id)
}

export function getFilamentColorName(color: FilamentColor | ColorVariant, locale: string): string {
  switch (locale) {
    case 'hu':
      return color.name
    case 'en':
      return color.nameEn ?? color.name
    case 'de':
      return color.nameDe ?? color.nameEn ?? color.name
    case 'ro':
      return color.nameRo ?? color.nameEn ?? color.name
    default:
      return color.nameEn ?? color.name
  }
}

/** HEX normalizálás (#rrggbb); érvénytelen esetén fallback. */
export function normalizeHexColor(value: string, fallback = '#888888'): string {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  let hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return fallback
  return hex.toLowerCase()
}

/** Id generálás színnévből / hexből. */
export function slugifyColorId(name: string, hex?: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base) return base.slice(0, 40)
  const h = normalizeHexColor(hex || '', '').replace('#', '')
  return h ? `color-${h}` : `color-${Date.now().toString(36)}`
}

function filamentToVariant(c: FilamentColor, images: string[] = []): ColorVariant {
  return {
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    nameDe: c.nameDe,
    nameRo: c.nameRo,
    hex: normalizeHexColor(c.hex),
    images,
  }
}

/** DB / JSON → ColorVariant tömb (array vagy legacy Record formátum). */
export function normalizeColorVariants(value: unknown): ColorVariant[] {
  if (!value) return []

  if (Array.isArray(value)) {
    const out: ColorVariant[] = []
    const seen = new Set<string>()
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      const hexRaw = typeof row.hex === 'string' ? row.hex : ''
      const hex = normalizeHexColor(hexRaw || name)
      const idRaw = typeof row.id === 'string' ? row.id.trim() : ''
      const id = idRaw || slugifyColorId(name || hex, hex)
      if (!id || seen.has(id)) continue
      const images = normalizeImageUrls(row.images)
      const filament = getFilamentColorById(id)
      out.push({
        id,
        name: name || filament?.name || hex.toUpperCase(),
        nameEn: typeof row.nameEn === 'string' ? row.nameEn : filament?.nameEn,
        nameDe: typeof row.nameDe === 'string' ? row.nameDe : filament?.nameDe,
        nameRo: typeof row.nameRo === 'string' ? row.nameRo : filament?.nameRo,
        hex,
        images,
      })
      seen.add(id)
    }
    return out
  }

  if (typeof value === 'object') {
    const map = value as Record<string, unknown>
    const out: ColorVariant[] = []
    for (const [key, urls] of Object.entries(map)) {
      if (!key.trim() || key.startsWith('__')) continue
      if (!Array.isArray(urls)) continue
      const images = normalizeImageUrls(urls)
      if (images.length === 0) continue
      const filament = getFilamentColorById(key)
      out.push(
        filament
          ? filamentToVariant(filament, images)
          : {
              id: key,
              name: key,
              hex: normalizeHexColor(key.startsWith('#') ? key : '#888888'),
              images,
            }
      )
    }
    return out
  }

  return []
}

/** ColorVariant[] → legacy map (API / getGalleryImagesForColor). */
export function colorVariantsToMap(variants: ColorVariant[]): ColorImagesMap {
  const out: ColorImagesMap = {}
  for (const v of variants) {
    const images = normalizeImageUrls(v.images)
    if (images.length > 0) out[v.id] = images
  }
  return out
}

/** Mentéshez: csak érvényes variánsok tömbje. */
export function serializeColorVariants(variants: ColorVariant[]): ColorVariant[] {
  return normalizeColorVariants(variants).filter((v) => v.images.length > 0 || v.name.trim().length > 0)
}

/** DB / JSON → tisztított colorImages térkép (üres tömbök kihagyva). */
export function normalizeColorImages(value: unknown): ColorImagesMap {
  return colorVariantsToMap(normalizeColorVariants(value))
}

/** Van-e legalább egy színhez feltöltött kép. */
export function hasAnyColorImages(colorImages?: ColorImagesMap | ColorVariant[] | null): boolean {
  const variants = normalizeColorVariants(colorImages)
  return variants.some((v) => v.images.length > 0)
}

/**
 * Shopban megjelenő színek.
 * Ha van színenkénti kép → azok a variánsok.
 * Egyébként színezhető 3D terméknél → teljes filament lista (modell színezéshez).
 */
export function getAvailableFilamentColors(
  colorImages: ColorImagesMap | ColorVariant[] | null | undefined,
  isColorable: boolean
): FilamentColor[] {
  return getAvailableColorVariants(colorImages, isColorable).map((v) => ({
    id: v.id,
    name: v.name,
    nameEn: v.nameEn,
    nameDe: v.nameDe,
    nameRo: v.nameRo,
    hex: v.hex,
  }))
}

/** Shop színválasztó: ColorVariant listával (képekkel együtt). */
export function getAvailableColorVariants(
  colorImages: ColorImagesMap | ColorVariant[] | null | undefined,
  isColorable: boolean
): ColorVariant[] {
  const variants = normalizeColorVariants(colorImages)
  const withImages = variants.filter((v) => v.images.length > 0)
  if (withImages.length > 0) return withImages
  if (isColorable) return FILAMENT_COLORS.map((c) => filamentToVariant(c, []))
  return []
}

/** Galéria egy színhez; ha nincs, a termék általános képei. */
export function getGalleryImagesForColor(
  product: { image?: string; images?: string[]; colorImages?: ColorImagesMap | ColorVariant[] | null },
  colorId?: string | null
): string[] {
  if (colorId) {
    const variants = normalizeColorVariants(product.colorImages)
    const byColor = variants.find((v) => v.id === colorId)
    if (byColor?.images?.length) return byColor.images
    const map = normalizeColorImages(product.colorImages)
    if (map[colorId]?.length) return map[colorId]
  }
  const fromImages = normalizeImageUrls(product.images)
  if (fromImages.length) return fromImages
  if (product.image && typeof product.image === 'string') {
    const main = product.image.trim()
    if (main) return [main]
  }
  return []
}
