/**
 * 3D nyomtatóanyagok (Bambu Lab P1S farm).
 * Bővíthető lista – csak az admin választ ezekből; a webshop vendégei nem látják.
 */

export const FILAMENT_MATERIALS = ['PLA', 'PETG', 'TPU'] as const

export type FilamentMaterial = (typeof FILAMENT_MATERIALS)[number]

export const DEFAULT_FILAMENT_MATERIAL: FilamentMaterial = 'PLA'

export function isFilamentMaterial(value: unknown): value is FilamentMaterial {
  return typeof value === 'string' && (FILAMENT_MATERIALS as readonly string[]).includes(value)
}

/** Egyedi, érvényes anyaglista. Üres bemenet → üres tömb (nem 3D termék). */
export function normalizeMaterials(raw: unknown): FilamentMaterial[] {
  const source = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const out: FilamentMaterial[] = []
  const seen = new Set<string>()
  for (const item of source) {
    if (typeof item !== 'string') continue
    const value = item.trim().toUpperCase()
    if (!isFilamentMaterial(value) || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * Admin mentés: legalább egy anyag, ha a termék 3D kategóriájú.
 * Nem 3D terméknél az üres lista megengedett.
 */
export function resolveProductMaterials(
  raw: unknown,
  opts?: { requireAtLeastOne?: boolean }
): FilamentMaterial[] {
  const materials = normalizeMaterials(raw)
  if (materials.length > 0) return materials
  if (opts?.requireAtLeastOne) return [DEFAULT_FILAMENT_MATERIAL]
  return []
}

export function defaultMaterialForProduct(materials: readonly string[] | null | undefined): FilamentMaterial | null {
  const normalized = normalizeMaterials(materials)
  return normalized[0] ?? null
}
