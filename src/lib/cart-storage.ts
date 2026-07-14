/** Opcionális termék opciók (pl. 3D: filament szín + anyag PLA/PETG). */
export type CartItemOptions = {
  colorName?: string
  colorHex?: string
  materialName?: string
}

export type CartItem = {
  productId: string
  qty: number
  options?: CartItemOptions
}

export const CART_STORAGE_KEY = 'gulumen-cart'

/** Régi vagy külső kulcsok – kijelentkezéskor mind törlődik. */
const LEGACY_CART_KEYS = ['cart', 'cartItems', CART_STORAGE_KEY] as const

export function loadPersistedCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x: Record<string, unknown>) => {
        const opts = x.options as Record<string, unknown> | undefined
        return {
          productId: String(x.productId ?? ''),
          qty: Math.max(1, Number(x.qty) || 1),
          options:
            opts && (opts.colorName != null || opts.colorHex != null || opts.materialName != null)
              ? {
                  colorName: opts.colorName != null ? String(opts.colorName) : undefined,
                  colorHex: opts.colorHex != null ? String(opts.colorHex) : undefined,
                  materialName: opts.materialName != null ? String(opts.materialName) : undefined,
                }
              : undefined,
        }
      })
      .filter((x: CartItem) => x.productId !== '')
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
