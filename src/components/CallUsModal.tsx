'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { localizePath } from '@/i18n/routing'

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+36301234567'
const TEL_LINK = `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`

const QR_SIZE = 200
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(TEL_LINK)}`

type Props = { isOpen: boolean; onClose: () => void }

export function CallUsModal({ isOpen, onClose }: Props) {
  const { t, locale } = useLocale()
  const [activeTab, setActiveTab] = useState<'call' | 'callback'>('call')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [topic, setTopic] = useState('')
  const [immediatePreferred, setImmediatePreferred] = useState(true)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackHour, setCallbackHour] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const HOURS = Array.from({ length: 11 }, (_, i) => i + 8)
  const today = (() => {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  })()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleSubmitCallback = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const nameTrim = name.trim()
      const phoneTrim = phone.trim()
      if (!nameTrim || !phoneTrim) {
        setStatus('error')
        setErrorMessage(t('callUs.callbackErrorRequired') || 'Név és telefonszám kötelező.')
        return
      }
      setStatus('sending')
      setErrorMessage('')
      try {
        const preferredTimeValue = immediatePreferred
          ? (t('callUs.callbackOptionImmediate') || 'Azonnali (5–10 percen belül)')
          : callbackDate && callbackHour
            ? `${callbackDate.replace(/-/g, '.')}. ${callbackHour}:00`
            : undefined
        const res = await fetch('/api/callback-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameTrim,
            phone: phoneTrim,
            topic: topic.trim() || undefined,
            preferredTime: preferredTimeValue,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data?.error || t('callUs.callbackError') || 'A kérés sikertelen.')
          return
        }
        setStatus('success')
        setName('')
        setPhone('')
        setTopic('')
        setImmediatePreferred(true)
        setCallbackDate('')
        setCallbackHour('')
      } catch {
        setStatus('error')
        setErrorMessage(t('callUs.callbackError') || 'A kérés sikertelen.')
      }
    },
    [name, phone, topic, immediatePreferred, callbackDate, callbackHour, t]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-us-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 id="call-us-modal-title" className="font-heading font-semibold text-lg text-foreground">
            {t('callUs.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
            aria-label={t('buttons.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--border)] flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('call')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'call'
                ? 'bg-accent text-white'
                : 'bg-[var(--border)] text-foreground hover:bg-[var(--border)]/80'
            }`}
          >
            {t('callUs.tabCall')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('callback')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'callback'
                ? 'bg-accent text-white'
                : 'bg-[var(--border)] text-foreground hover:bg-[var(--border)]/80'
            }`}
          >
            {t('callUs.tabCallback')}
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'call' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">{t('callUs.desktopHint')}</p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a
                  href={TEL_LINK}
                  className="text-xl font-semibold text-accent hover:underline"
                  aria-label={t('callUs.callNumber')}
                >
                  {SUPPORT_PHONE}
                </a>
                <img
                  src={QR_URL}
                  alt=""
                  width={QR_SIZE}
                  height={QR_SIZE}
                  className="rounded-lg border border-[var(--border)] bg-white"
                />
              </div>
              <p className="text-xs text-muted">{t('callUs.qrHint')}</p>
              <p className="text-xs text-muted">
                {t('callUs.recordingNotice')}{' '}
                <a
                  href={`${localizePath('/kapcsolat', locale)}#telefonos-adatkezeles`}
                  className="text-accent hover:underline"
                >
                  {t('callUs.recordingNoticeLink')}
                </a>
              </p>
            </div>
          )}

          {activeTab === 'callback' && (
            <form onSubmit={handleSubmitCallback} className="space-y-4">
              <div>
                <label htmlFor="callback-name" className="block text-sm font-medium text-foreground mb-1">
                  {t('callUs.callbackName')} *
                </label>
                <input
                  id="callback-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  placeholder={t('callUs.callbackNamePlaceholder')}
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="callback-phone" className="block text-sm font-medium text-foreground mb-1">
                  {t('callUs.callbackPhone')} *
                </label>
                <input
                  id="callback-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  placeholder={t('callUs.callbackPhonePlaceholder')}
                  required
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="callback-topic" className="block text-sm font-medium text-foreground mb-1">
                  {t('callUs.callbackTopic')}
                </label>
                <input
                  id="callback-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  placeholder={t('callUs.callbackTopicPlaceholder')}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">
                  {t('callUs.callbackTime')}
                </p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="callback-when"
                      checked={immediatePreferred}
                      onChange={() => setImmediatePreferred(true)}
                      className="w-4 h-4 text-accent border-[var(--border)]"
                    />
                    <span className="text-sm text-foreground">
                      {t('callUs.callbackOptionImmediate') || 'Azonnali (5–10 percen belül)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="callback-when"
                      checked={!immediatePreferred}
                      onChange={() => setImmediatePreferred(false)}
                      className="w-4 h-4 text-accent border-[var(--border)]"
                    />
                    <span className="text-sm text-foreground">
                      {t('callUs.callbackOptionLater') || 'Később (válassz dátumot és órát)'}
                    </span>
                  </label>
                </div>
                {!immediatePreferred && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[140px]">
                      <label htmlFor="callback-date" className="block text-xs font-medium text-muted mb-1">
                        {t('callUs.callbackDate') || 'Dátum'}
                      </label>
                      <input
                        id="callback-date"
                        type="date"
                        value={callbackDate}
                        onChange={(e) => setCallbackDate(e.target.value)}
                        min={today}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                      />
                    </div>
                    <div className="w-24">
                      <label htmlFor="callback-hour" className="block text-xs font-medium text-muted mb-1">
                        {t('callUs.callbackHour') || 'Óra'}
                      </label>
                      <select
                        id="callback-hour"
                        value={callbackHour}
                        onChange={(e) => setCallbackHour(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                      >
                        <option value="">–</option>
                        {HOURS.map((h) => (
                          <option key={h} value={String(h)}>
                            {h}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errorMessage}
                </p>
              )}
              {status === 'success' && (
                <p className="text-sm text-green-600 dark:text-green-400" role="status">
                  {t('callUs.callbackSuccess')}
                </p>
              )}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-3 bg-accent text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {status === 'sending' ? t('callUs.callbackSending') : t('callUs.callbackSubmit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
