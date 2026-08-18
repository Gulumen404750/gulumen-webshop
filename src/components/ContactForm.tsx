'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/context/LocaleContext'

type ContactFormProps = {
  supportEmail: string
}

const CONTACT_ERROR_KEYS = [
  'rateLimited',
  'invalidRequest',
  'nameRequired',
  'emailInvalid',
  'messageShort',
  'messageLong',
  'sendUnavailable',
  'inboxUnconfigured',
  'sendFailed',
  'server',
  'generic',
  'network',
] as const

export function ContactForm({ supportEmail }: ContactFormProps) {
  const { t } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const contactError = (code: string) => {
    const key = CONTACT_ERROR_KEYS.includes(code as (typeof CONTACT_ERROR_KEYS)[number])
      ? `pages.contact.error.${code}`
      : 'pages.contact.error.generic'
    return t(key)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const rendeles = params.get('rendeles')?.trim()
    const tipus = params.get('tipus')?.trim()
    // Régi e-mail linkek: kapcsolat?tipus=modositas → valódi szerkesztő oldal
    if (tipus === 'modositas' && rendeles) {
      window.location.replace(
        `/rendelesek/${encodeURIComponent(rendeles)}/modositas`
      )
      return
    }
    if (rendeles) setOrderRef(rendeles)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          orderRef: orderRef.trim() || undefined,
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(contactError(typeof data.code === 'string' ? data.code : 'generic'))
        return
      }
      setSuccess(t('pages.contact.success'))
      setName('')
      setEmail('')
      setOrderRef('')
      setMessage('')
    } catch {
      setError(contactError('network'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-white/30 max-w-xl">
      <h2 className="font-heading text-xl font-bold text-white mb-2 drop-shadow-lg">
        {t('pages.contact.formTitle')}
      </h2>
      <p className="text-gray-200 text-sm mb-4 drop-shadow">
        {t('pages.contact.formIntro')}{' '}
        <a href={`mailto:${supportEmail}`} className="text-accent hover:underline font-medium">
          {supportEmail}
        </a>
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="contact-name" className="block text-sm text-gray-200 mb-1">
            {t('pages.contact.nameLabel')}
          </label>
          <input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="w-full px-3 py-2 rounded-lg border border-white/30 bg-black/40 text-white placeholder:text-gray-400"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm text-gray-200 mb-1">
            {t('pages.contact.emailLabel')}
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-white/30 bg-black/40 text-white placeholder:text-gray-400"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="contact-order" className="block text-sm text-gray-200 mb-1">
            {t('pages.contact.orderRefLabel')}
          </label>
          <input
            id="contact-order"
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            maxLength={80}
            className="w-full px-3 py-2 rounded-lg border border-white/30 bg-black/40 text-white placeholder:text-gray-400"
            placeholder="ord_…"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="block text-sm text-gray-200 mb-1">
            {t('pages.contact.messageLabel')}
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-white/30 bg-black/40 text-white placeholder:text-gray-400"
          />
        </div>
        {error && (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-300" role="status">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t('pages.contact.submitting') : t('pages.contact.submit')}
        </button>
      </form>
    </div>
  )
}
