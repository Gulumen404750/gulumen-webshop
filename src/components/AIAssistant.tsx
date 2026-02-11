'use client'

import { useState, useRef, useEffect } from 'react'
import { getResponse } from '@/lib/ai-assistant'
import { useLocale } from '@/context/LocaleContext'

type Message = { role: 'user' | 'assistant'; text: string; escalate?: boolean }

export function AIAssistant() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    const { textKey, escalate } = getResponse(text)
    const reply = t(textKey)
    setMessages((m) => [...m, { role: 'assistant', text: reply, escalate }])
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-accent text-white font-heading font-semibold hover:opacity-90 transition-opacity"
        aria-label={t('ai.title')}
      >
        <span className="hidden sm:inline">{t('ai.cta')}</span>
        <ChatBubbleIcon className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md h-[min(80vh,28rem)] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl">
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
              <div ref={bottomRef} />
            </div>
            <form
              className="flex gap-2 p-4 border-t border-[var(--border)]"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('ai.placeholder')}
                className="flex-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-background text-foreground placeholder:text-muted text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90"
              >
                {t('ai.send')}
              </button>
            </form>
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

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
