'use client'

import { isRecaptchaBrowserEnabled } from '@/lib/recaptcha-browser'

/** Google reCAPTCHA v3 kötelező jogi szöveg (láthatatlan captcha). */
export function RecaptchaNotice({ className = '' }: { className?: string }) {
  if (!isRecaptchaBrowserEnabled()) return null
  return (
    <p className={`text-[11px] leading-snug text-muted ${className}`.trim()}>
      This site is protected by reCAPTCHA and the Google{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        Terms of Service
      </a>{' '}
      apply.
    </p>
  )
}
