import { FILAMENT_COLORS, type FilamentColor } from '@/lib/filamentColors'

export function normalizeColorHexParam(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null
  return hex.toLowerCase()
}

export function findFilamentColorByHex(hex: string): FilamentColor | undefined {
  const normalized = normalizeColorHexParam(hex)
  if (!normalized) return undefined
  return FILAMENT_COLORS.find((c) => c.hex.toLowerCase() === normalized)
}

export function buildColorableProductShareUrl(
  origin: string,
  slug: string,
  options: { colorHex: string }
): string {
  const normalizedHex = normalizeColorHexParam(options.colorHex)
  if (!normalizedHex) {
    return new URL(`/termek/${slug}`, origin).toString()
  }
  const url = new URL(`/termek/${slug}`, origin)
  url.searchParams.set('color', normalizedHex)
  return url.toString()
}
