/**
 * Belső termékkód / SKU: GUL-0000001454 mintázat, adminban kézzel is megadható.
 * A vásárlói frontend nem jeleníti meg.
 */

export const PRODUCT_SKU_MAX_LENGTH = 50
export const PRODUCT_SKU_PREFIX = 'GUL'
export const PRODUCT_SKU_NUMERIC_WIDTH = 10
export const GENERATED_SKU_PATTERN = /^GUL-\d{10}$/

/** Engedélyezett karakterek: A–Z, 0–9, kötőjel. */
const SKU_CHAR_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

export function normalizeProductSku(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!trimmed) return null
  return trimmed.slice(0, PRODUCT_SKU_MAX_LENGTH)
}

export function isValidProductSku(sku: string): boolean {
  if (!sku || sku.length > PRODUCT_SKU_MAX_LENGTH) return false
  return SKU_CHAR_PATTERN.test(sku)
}

export function formatGeneratedSku(seq: number): string {
  const n = Math.max(1, Math.floor(seq))
  return `${PRODUCT_SKU_PREFIX}-${String(n).padStart(PRODUCT_SKU_NUMERIC_WIDTH, '0')}`
}

export function parseGeneratedSkuSeq(sku: string): number | null {
  const match = sku.trim().toUpperCase().match(/^GUL-(\d{1,10})$/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Következő GUL-XXXXXXXXXX a meglévő kódok alapján. */
export function nextGeneratedSku(existingSkus: Array<string | null | undefined>): string {
  let max = 0
  for (const raw of existingSkus) {
    if (!raw) continue
    const seq = parseGeneratedSkuSeq(raw)
    if (seq != null && seq > max) max = seq
  }
  return formatGeneratedSku(max + 1)
}

export function skuZodMessage(): string {
  return `Érvénytelen SKU (max. ${PRODUCT_SKU_MAX_LENGTH} karakter, A–Z, 0–9, kötőjel; pl. GUL-0000001454)`
}
