/** Fizetés: ajándék / aktivitási pont checkbox – nyelvváltás és frissítés után is megmarad. */
const STORAGE_KEY = 'gulumen:checkoutUsePoints'

export type CheckoutPointsSelection = {
  useGiftPoints: boolean
  useActivityPoints: boolean
}

export function readCheckoutPointsSelection(): CheckoutPointsSelection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CheckoutPointsSelection>
    return {
      useGiftPoints: parsed.useGiftPoints === true,
      useActivityPoints: parsed.useActivityPoints === true,
    }
  } catch {
    return null
  }
}

export function writeCheckoutPointsSelection(selection: CheckoutPointsSelection): void {
  if (typeof window === 'undefined') return
  try {
    if (!selection.useGiftPoints && !selection.useActivityPoints) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  } catch {
    /* private mode */
  }
}
