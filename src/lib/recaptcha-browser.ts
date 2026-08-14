'use client'

import { applyCspNonceToScript } from '@/lib/csp-nonce-browser'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const SCRIPT_ID = 'recaptcha-v3'

function siteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || ''
}

export function isRecaptchaBrowserEnabled(): boolean {
  return siteKey().length > 0
}

function loadScript(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('recaptcha load failed')), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`
    script.async = true
    script.defer = true
    applyCspNonceToScript(script)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('recaptcha load failed'))
    document.head.appendChild(script)
  })
}

/** reCAPTCHA v3 token; ha nincs site key, null (a szerver kihagyja az ellenőrzést). */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  const key = siteKey()
  if (!key || typeof window === 'undefined') return null
  try {
    await loadScript(key)
    const grecaptcha = window.grecaptcha
    if (!grecaptcha) return null
    return await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(key, { action }).then(resolve).catch(reject)
      })
    })
  } catch {
    return null
  }
}
