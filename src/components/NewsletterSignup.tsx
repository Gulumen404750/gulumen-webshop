'use client'

import { useState } from 'react'
import { useLocale } from '@/context/LocaleContext'

export function NewsletterSignup() {
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('ok')
        setMessage(t('newsletter.success'))
        setEmail('')
      } else {
        setStatus('error')
        setMessage(t('newsletter.error'))
      }
    } catch {
      setStatus('error')
      setMessage(t('newsletter.error'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
      <label htmlFor="newsletter-email" className="sr-only">
        {t('newsletter.emailLabel')}
      </label>
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('newsletter.placeholder')}
        disabled={status === 'loading'}
        className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground placeholder:text-muted"
        required
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {status === 'loading' ? (t('newsletter.sending')) : (t('newsletter.submit'))}
      </button>
      {message && (
        <p className={`text-sm w-full ${status === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} role="status">
          {message}
        </p>
      )}
    </form>
  )
}
