/** sessionStorage kulcs – Google OAuth előtt mentett regisztrációs hozzájárulás. */
export const GOOGLE_AUTH_PENDING_KEY = 'gulumen-google-auth-pending'

export type GoogleAuthPending = {
  /** Kötelező ÁSZF / adatkezelés elfogadva a Google indítás előtt (regisztrációs oldal). */
  acceptPrivacy: boolean
  /** Opcionális kupon + ajánlat e-mailek. */
  acceptOffers: boolean
  at: number
}

export function saveGoogleAuthPending(options: {
  acceptPrivacy?: boolean
  acceptOffers?: boolean
}): void {
  if (typeof window === 'undefined') return
  const payload: GoogleAuthPending = {
    acceptPrivacy: options.acceptPrivacy === true,
    acceptOffers: options.acceptOffers === true,
    at: Date.now(),
  }
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, JSON.stringify(payload))
}

export function readGoogleAuthPending(): GoogleAuthPending | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleAuthPending> & { acceptOffers?: boolean }
    if (typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > 10 * 60 * 1000) {
      sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY)
      return null
    }
    return {
      acceptPrivacy: parsed.acceptPrivacy === true,
      acceptOffers: parsed.acceptOffers === true,
      at: parsed.at,
    }
  } catch {
    return null
  }
}

export function clearGoogleAuthPending(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY)
}
