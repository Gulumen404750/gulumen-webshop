/** Opcionális termék opciók (pl. 3D: filament szín). */
export type CartItemOptions = {
  colorName?: string
  colorHex?: string
  materialName?: string
}

/**
 * Kosár sor: productId + qty + options, plusz megjelenítési snapshot
 * (név / ár / kép), hogy a ProductsContext betöltése előtt se legyen
 * nyers ID, 0 Ft vagy üres kép.
 */
export type CartItem = {
  productId: string
  qty: number
  options?: CartItemOptions
  name?: string
  nameEn?: string
  nameDe?: string
  nameRo?: string
  priceHuf?: number
  image?: string
}

export const CART_STORAGE_KEY = 'gulumen-cart'

/** Régi vagy külső kulcsok – kijelentkezéskor mind törlődik. */
const LEGACY_CART_KEYS = ['cart', 'cartItems', CART_STORAGE_KEY] as const

function parseOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s || undefined
}

function parseOptionalPrice(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n)
}

export function normalizeCartItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const x = raw as Record<string, unknown>
  const productId = String(x.productId ?? '').trim()
  if (!productId) return null
  const opts = x.options as Record<string, unknown> | undefined
  const options =
    opts && (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
      ? {
          colorName: opts.colorName != null ? String(opts.colorName) : undefined,
          colorHex: opts.colorHex != null ? String(opts.colorHex) : undefined,
          materialName: opts.materialName != null ? String(opts.materialName) : undefined,
        }
      : undefined

  return {
    productId,
    qty: Math.max(1, Number(x.qty) || 1),
    options,
    name: parseOptionalString(x.name),
    nameEn: parseOptionalString(x.nameEn),
    nameDe: parseOptionalString(x.nameDe),
    nameRo: parseOptionalString(x.nameRo),
    priceHuf: parseOptionalPrice(x.priceHuf),
    image: parseOptionalString(x.image),
  }
}

export function loadPersistedCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeCartItem).filter((x): x is CartItem => x != null)
  } catch {
    return []
  }
}

export function savePersistedCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  if (items.length === 0) {
    localStorage.removeItem(CART_STORAGE_KEY)
    return
  }
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

/** Kijelentkezéskor: local + session storage kosár kulcsok törlése. */
export function clearPersistedCart() {
  if (typeof window === 'undefined') return
  for (const key of LEGACY_CART_KEYS) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
}
