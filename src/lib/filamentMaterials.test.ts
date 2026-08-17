import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILAMENT_MATERIAL,
  defaultMaterialForProduct,
  isFilamentMaterial,
  normalizeMaterials,
  resolveProductMaterials,
} from './filamentMaterials'

describe('filament materials', () => {
  it('accepts the expandable PLA/PETG/TPU catalog', () => {
    expect(isFilamentMaterial('PLA')).toBe(true)
    expect(isFilamentMaterial('PETG')).toBe(true)
    expect(isFilamentMaterial('TPU')).toBe(true)
    expect(isFilamentMaterial('ABS')).toBe(false)
    expect(isFilamentMaterial('pla')).toBe(false)
  })

  it('normalizes, uppercases and de-duplicates', () => {
    expect(normalizeMaterials([' pla ', 'PETG', 'PLA', 'ABS', 1])).toEqual(['PLA', 'PETG'])
    expect(normalizeMaterials('TPU')).toEqual(['TPU'])
    expect(normalizeMaterials(null)).toEqual([])
  })

  it('defaults 3D products to PLA when empty', () => {
    expect(resolveProductMaterials([], { requireAtLeastOne: true })).toEqual([DEFAULT_FILAMENT_MATERIAL])
    expect(resolveProductMaterials([], { requireAtLeastOne: false })).toEqual([])
  })

  it('picks the first available material', () => {
    expect(defaultMaterialForProduct(['PETG', 'PLA'])).toBe('PETG')
    expect(defaultMaterialForProduct([])).toBeNull()
  })
})
