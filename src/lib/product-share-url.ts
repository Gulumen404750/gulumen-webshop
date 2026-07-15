import { FILAMENT_COLORS, type FilamentColor } from '@/lib/filamentColors'

export type ProductMaterial = 'PLA' | 'PETG'

export function normalizeColorHexParam(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null
  return hex.toLowerCase()
}

export function parseMaterialParam(value: string | null): ProductMaterial | null {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  if (upper === 'PLA' || upper === 'PETG') return upper
  return null
}

export function findFilamentColorByHex(hex: string): FilamentColor | undefined {
  const normalized = normalizeColorHexParam(hex)
  if (!normalized) return undefined
  return FILAMENT_COLORS.find((c) => c.hex.toLowerCase() === normalized)
}

export function buildColorableProductShareUrl(
  origin: string,
  slug: string,
  options: { colorHex: string; material?: ProductMaterial | null }
): string {
  const normalizedHex = normalizeColorHexParam(options.colorHex)
  if (!normalizedHex) {
    return new URL(`/termek/${slug}`, origin).toString()
  }
  const url = new URL(`/termek/${slug}`, origin)
  url.searchParams.set('color', normalizedHex)
  if (options.material) {
    url.searchParams.set('material', options.material)
  }
  return url.toString()
}
