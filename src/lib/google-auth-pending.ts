/** sessionStorage kulcs – Google OAuth előtt mentett regisztrációs hozzájárulás. */
export const GOOGLE_AUTH_PENDING_KEY = 'gulumen-google-auth-pending'

export type GoogleAuthPending = {
  acceptOffers: boolean
  at: number
}

export function saveGoogleAuthPending(acceptOffers: boolean): void {
  if (typeof window === 'undefined') return
  const payload: GoogleAuthPending = { acceptOffers, at: Date.now() }
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, JSON.stringify(payload))
}

export function readGoogleAuthPending(): GoogleAuthPending | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GoogleAuthPending
    if (typeof parsed.acceptOffers !== 'boolean' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > 10 * 60 * 1000) {
      sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearGoogleAuthPending(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY)
}
