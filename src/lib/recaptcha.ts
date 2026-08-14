/**
 * Google reCAPTCHA v3 – szerveroldali siteverify.
 * Ha NEXT_PUBLIC_RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY hiányzik: kihagyás (dev).
 */

import { RECAPTCHA_ACTIONS, type RecaptchaAction } from '@/lib/recaptcha-constants'

export { RECAPTCHA_ACTIONS, type RecaptchaAction }

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const DEFAULT_MIN_SCORE = 0.5

export type RecaptchaDecision =
  | { ok: true; skipped: true }
  | { ok: true; skipped?: false; score: number }
  | { ok: false; reason: 'missing' | 'invalid' | 'low_score' | 'action' | 'upstream'; error: string }

let warnedMissing = false

export function isRecaptchaConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.RECAPTCHA_SECRET_KEY?.trim() && env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim())
}

export function getRecaptchaMinScore(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.RECAPTCHA_MIN_SCORE)
  if (!Number.isFinite(raw)) return DEFAULT_MIN_SCORE
  return Math.min(1, Math.max(0, raw))
}

function parseToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const token = raw.trim()
  if (token.length < 20 || token.length > 4000) return null
  return token
}

type SiteVerifyResponse = {
  success?: boolean
  score?: number
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function verifyRecaptchaToken(
  params: { token: unknown; action: RecaptchaAction; ip?: string },
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch
): Promise<RecaptchaDecision> {
  if (!isRecaptchaConfigured(env)) {
    if (env.NODE_ENV === 'production' && !warnedMissing) {
      warnedMissing = true
      console.warn(
        '[recaptcha] NEXT_PUBLIC_RECAPTCHA_SITE_KEY / RECAPTCHA_SECRET_KEY unset; login captcha skipped'
      )
    }
    return { ok: true, skipped: true }
  }

  const token = parseToken(params.token)
  if (!token) {
    return { ok: false, reason: 'missing', error: 'Captcha ellenőrzés szükséges.' }
  }

  const secret = env.RECAPTCHA_SECRET_KEY!.trim()
  const body = new URLSearchParams({
    secret,
    response: token,
  })
  if (params.ip && params.ip !== 'unknown') body.set('remoteip', params.ip)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  let json: SiteVerifyResponse
  try {
    const res = await fetcher(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctrl.signal,
    })
    json = (await res.json().catch(() => ({}))) as SiteVerifyResponse
    if (!res.ok) {
      return { ok: false, reason: 'upstream', error: 'Captcha ellenőrzés sikertelen.' }
    }
  } catch {
    return { ok: false, reason: 'upstream', error: 'Captcha ellenőrzés sikertelen.' }
  } finally {
    clearTimeout(timer)
  }

  if (!json.success) {
    return { ok: false, reason: 'invalid', error: 'Captcha ellenőrzés sikertelen.' }
  }
  if (json.action && json.action !== params.action) {
    return { ok: false, reason: 'action', error: 'Captcha ellenőrzés sikertelen.' }
  }
  const score = typeof json.score === 'number' ? json.score : 0
  const min = getRecaptchaMinScore(env)
  if (score < min) {
    return { ok: false, reason: 'low_score', error: 'Captcha ellenőrzés sikertelen.' }
  }
  return { ok: true, score }
}

/** Teszt: a production figyelmeztetés újra megjelenhessen. */
export function resetRecaptchaWarningForTests(): void {
  warnedMissing = false
}
