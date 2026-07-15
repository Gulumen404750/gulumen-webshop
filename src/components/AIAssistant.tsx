'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { getResponse } from '@/lib/ai-assistant'
import {
  MOBILE_FAB_Z,
  mobileAiFabMaxWidth,
  mobileFabBottom,
  mobileFabRight,
} from '@/lib/mobile-fab-layout'
import { useLocale } from '@/context/LocaleContext'
import type { Locale } from '@/i18n/locales'

type Message = { role: 'user' | 'assistant'; text: string; escalate?: boolean }

const SPEECH_LANG: Record<Locale, string> = {
  hu: 'hu-HU',
  en: 'en-US',
  de: 'de-DE',
  ro: 'ro-RO',
}

function getSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function AIAssistant() {
  const { t, locale } = useLocale()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      setInput('')
      setMessages((m) => [...m, { role: 'user', text: trimmed }])
      setLoading(true)
      const previousMessages = messagesRef.current.map((m) => ({ role: m.role, text: m.text }))
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, locale, messages: previousMessages }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && typeof data?.text === 'string') {
          setMessages((m) => [...m, { role: 'assistant', text: data.text, escalate: !!data.escalate }])
        } else {
          const { textKey, escalate } = getResponse(trimmed)
          const fallbackText = t(textKey)
          const errorNote = !res.ok && data?.error ? ` (${t('ai.serviceError')})` : ''
          setMessages((m) => [...m, { role: 'assistant', text: fallbackText + errorNote, escalate }])
        }
      } catch {
        const { textKey, escalate } = getResponse(trimmed)
        setMessages((m) => [...m, { role: 'assistant', text: t(textKey), escalate }])
      } finally {
        setLoading(false)
      }
    },
    [loading, locale, t]
  )

  const send = () => sendMessage(input)

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (listening) {
      stopListening()
      return
    }
    const recognition = getSpeechRecognition()
    if (!recognition) return

    recognition.lang = SPEECH_LANG[locale] ?? 'hu-HU'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript.trim())
      if (event.results[event.results.length - 1]?.isFinal && transcript.trim()) {
        stopListening()
        void sendMessage(transcript.trim())
      }
    }

    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [listening, locale, sendMessage, stopListening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const openCallUs = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openCallUsModal'))
    }
  }

  const fabStyle = {
    right: mobileFabRight,
  } as const

  return (
    <>
      <div
        className="hidden md:flex fixed bottom-6 flex-col items-end gap-3"
        style={{
          ...fabStyle,
          bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          zIndex: MOBILE_FAB_Z,
        }}
      >
        <button
          type="button"
          onClick={openCallUs}
          className="group flex items-center gap-2 rounded-full pl-2 pr-4 py-2.5 shadow-lg bg-black/80 hover:bg-black/90 text-white font-heading font-semibold transition-colors border-2 border-red-500/60"
          aria-label={t('callUs.title')}
        >
          <span className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden bg-red-900/30 phone-ring-hover shrink-0">
            <Image
              src="/img/rotary-phone.png"
              alt=""
              width={48}
              height={48}
              className="w-full h-full object-contain"
              unoptimized
            />
          </span>
          <span className="text-sm whitespace-nowrap">{t('callUs.title')}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-accent text-white font-heading font-semibold hover:opacity-90 transition-opacity"
          aria-label={t('ai.title')}
        >
          <span>{t('ai.cta')}</span>
          <ChatBubbleIcon className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-accent text-white font-heading font-semibold hover:opacity-90 transition-opacity"
        style={{
          zIndex: MOBILE_FAB_Z,
          right: mobileFabRight,
          bottom: mobileFabBottom,
          maxWidth: mobileAiFabMaxWidth,
        }}
        aria-label={t('ai.title')}
      >
        <ChatBubbleIcon className="w-5 h-5 shrink-0" />
        <span className="text-sm truncate">{t('ai.cta')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:justify-end p-0 sm:p-4 md:p-6"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md h-[min(88vh,32rem)] sm:h-[min(80vh,28rem)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-heading font-semibold text-foreground">{t('ai.title')}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
                aria-label={t('buttons.close')}
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-muted">{t('ai.greeting')}</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-accent text-white'
                        : 'bg-[var(--border)] text-foreground'
                    } ${m.escalate ? 'ring-2 ring-discount' : ''}`}
                  >
                    {m.text}
                    {m.escalate && (
                      <p className="mt-2 text-xs opacity-90">{t('ai.escalateNote')}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-2 text-sm bg-[var(--border)] text-muted">
                    …
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form
              className="flex gap-2 p-4 border-t border-[var(--border)]"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={loading}
                  className={`shrink-0 p-2.5 rounded-xl border font-medium text-sm transition-colors disabled:opacity-60 ${
                    listening
                      ? 'border-red-500 bg-red-500/15 text-red-600 animate-pulse'
                      : 'border-[var(--border)] text-foreground hover:bg-[var(--border)]'
                  }`}
                  aria-label={listening ? t('ai.voiceStop') : t('ai.voiceStart')}
                  title={listening ? t('ai.voiceStop') : t('ai.voiceStart')}
                >
                  <MicIcon className="w-5 h-5" />
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? t('ai.voiceListening') : t('ai.placeholder')}
                disabled={loading}
                className="flex-1 min-w-0 px-4 py-2 rounded-xl border border-[var(--border)] bg-background text-foreground placeholder:text-muted text-sm disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 px-4 py-2 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('ai.send')}
              </button>
            </form>
            {!voiceSupported && (
              <p className="px-4 pb-3 text-xs text-muted">{t('ai.voiceUnsupported')}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
