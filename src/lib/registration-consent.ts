/** Új fiók (első Google / regisztráció) adatvédelmi hozzájárulás kliens oldali nyomon követése. */

const CONSENT_KEY_PREFIX = 'gulumen-registration-consent:'

export type RegistrationConsentRecord = {
  privacy: true
  acceptOffers: boolean
  at: number
}

function keyForEmail(email: string): string {
  return `${CONSENT_KEY_PREFIX}${email.trim().toLowerCase()}`
}

export function hasRegistrationConsent(email: string | null | undefined): boolean {
  if (typeof window === 'undefined' || !email) return false
  try {
    const raw = localStorage.getItem(keyForEmail(email))
    if (!raw) return false
    const parsed = JSON.parse(raw) as RegistrationConsentRecord
    return parsed?.privacy === true
  } catch {
    return false
  }
}

export function markRegistrationConsent(
  email: string,
  acceptOffers: boolean
): void {
  if (typeof window === 'undefined' || !email.trim()) return
  const payload: RegistrationConsentRecord = {
    privacy: true,
    acceptOffers: acceptOffers === true,
    at: Date.now(),
  }
  localStorage.setItem(keyForEmail(email), JSON.stringify(payload))
}
