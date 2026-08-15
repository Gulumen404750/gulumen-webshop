'use client'

import { useState } from 'react'

type ContactFormProps = {
  supportEmail: string
}

export function ContactForm({ supportEmail }: ContactFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        setError(typeof data.error === 'string' ? data.error : 'Küldés sikertelen.')
        return
      }
      setSuccess(typeof data.message === 'string' ? data.message : 'Üzeneted megérkezett.')
      setName('')
      setEmail('')
      setOrderRef('')
      setMessage('')
    } catch {
      setError('Hálózati hiba. Próbáld újra.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-white/30 max-w-xl">
      <h2 className="font-heading text-xl font-bold text-white mb-2 drop-shadow-lg">
        Írj nekünk
      </h2>
      <p className="text-gray-200 text-sm mb-4 drop-shadow">
        Az üzeneted közvetlenül az ügyfélszolgálatra érkezik. Válaszolhatsz e-mailben is:{' '}
        <a href={`mailto:${supportEmail}`} className="text-accent hover:underline font-medium">
          {supportEmail}
        </a>
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="contact-name" className="block text-sm text-gray-200 mb-1">
            Név
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
            E-mail
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
            Rendelésszám (opcionális)
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
            Üzenet
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
          {pending ? 'Küldés…' : 'Üzenet küldése'}
        </button>
      </form>
    </div>
  )
}
