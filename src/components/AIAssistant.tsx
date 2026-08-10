'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getResponse } from '@/lib/ai-assistant'
import { extractProductSlugFromPathname } from '@/lib/chat-product-context'
import {
  MOBILE_FAB_Z,
  mobileAiFabMaxWidth,
  mobileFabBottom,
  mobileFabRight,
} from '@/lib/mobile-fab-layout'
import { useLocale } from '@/context/LocaleContext'
import { useProducts } from '@/context/ProductsContext'
import { useCart } from '@/context/CartContext'
import { useToast } from '@/context/ToastContext'
import { getProductById as getProductByIdFromData, getProductName, type Product } from '@/lib/data'
import { useSaleActive } from '@/hooks/useSaleActive'
import type { Locale } from '@/i18n/locales'
import { parseChatTextParts } from '@/lib/chat-message-format'

type ChatProductSnippet = {
  id: string
  slug: string
  name: string
  priceHuf: number
  discountPriceHuf?: number | null
  image?: string
  category?: string
}

type Message = {
  role: 'user' | 'assistant'
  text: string
  escalate?: boolean
  productIds?: string[]
  products?: ChatProductSnippet[]
}

function parseProductIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 3)
  return ids.length > 0 ? ids : undefined
}

function parseProductSnippets(value: unknown): ChatProductSnippet[] | undefined {
  if (!Array.isArray(value)) return undefined
  const products = value
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : '',
      slug: typeof p.slug === 'string' ? p.slug : '',
      name: typeof p.name === 'string' ? p.name : '',
      priceHuf: typeof p.priceHuf === 'number' ? p.priceHuf : 0,
      discountPriceHuf: typeof p.discountPriceHuf === 'number' ? p.discountPriceHuf : null,
      image: typeof p.image === 'string' ? p.image : '',
      category: typeof p.category === 'string' ? p.category : '',
    }))
    .filter((p) => p.id && p.slug && p.name)
    .slice(0, 3)
  return products.length > 0 ? products : undefined
}

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
  const pathname = usePathname()
  const productSlug = useMemo(() => extractProductSlugFromPathname(pathname), [pathname])
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
        const timezone =
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            locale,
            timezone,
            messages: previousMessages,
            ...(productSlug ? { productSlug } : {}),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && typeof data?.text === 'string') {
          const productIds = parseProductIds(data.productIds)
          const products = parseProductSnippets(data.products)
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              text: data.text,
              escalate: !!data.escalate,
              ...(productIds ? { productIds } : {}),
              ...(products ? { products } : {}),
            },
          ])
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
    [loading, locale, t, productSlug]
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

  return (
    <>
      {/* Egyetlen lebegő gomb minden breakpointon: kék chat widget */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-accent text-white font-heading font-semibold hover:opacity-90 transition-opacity"
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
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
              <span className="font-heading font-semibold text-foreground">{t('ai.title')}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={openCallUs}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--border)] transition-colors"
                  aria-label={t('callUs.title')}
                >
                  <PhoneIcon className="w-4 h-4 shrink-0" />
                  <span>{t('callUs.title')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
                  aria-label={t('buttons.close')}
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
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
                  <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? '' : 'w-full'}`}>
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm ${
                        m.role === 'user'
                          ? 'bg-accent text-white'
                          : 'bg-[var(--border)] text-foreground'
                      } ${m.escalate ? 'ring-2 ring-discount' : ''}`}
                    >
                      <ChatMessageBody text={m.text} />
                      {m.escalate && (
                        <p className="mt-2 text-xs opacity-90">{t('ai.escalateNote')}</p>
                      )}
                    </div>
                    {m.role === 'assistant' && m.productIds && m.productIds.length > 0 && (
                      <ChatProductRecommendations
                        productIds={m.productIds}
                        snippets={m.products}
                        onNavigate={() => setOpen(false)}
                      />
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

function ChatMessageBody({ text }: { text: string }) {
  const parts = parseChatTextParts(text)
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, idx) => {
        if (part.type === 'break') return <br key={`br-${idx}`} />
        if (part.type === 'bold') {
          return (
            <strong key={`b-${idx}`} className="font-semibold">
              {part.value}
            </strong>
          )
        }
        return <span key={`t-${idx}`}>{part.value}</span>
      })}
    </div>
  )
}

function ChatProductRecommendations({
  productIds,
  snippets,
  onNavigate,
}: {
  productIds: string[]
  snippets?: ChatProductSnippet[]
  onNavigate?: () => void
}) {
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = useCallback(
    (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id),
    [getProductByIdFromContext]
  )
  const snippetById = useMemo(() => {
    const map = new Map<string, ChatProductSnippet>()
    for (const s of snippets ?? []) map.set(s.id, s)
    return map
  }, [snippets])

  const cards = productIds
    .map((id) => {
      const full = getProductById(id)
      if (full) return { kind: 'full' as const, product: full }
      const snip = snippetById.get(id)
      if (snip) return { kind: 'snip' as const, product: snip }
      return null
    })
    .filter((c): c is NonNullable<typeof c> => c != null)
    .slice(0, 3)

  if (cards.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {cards.map((card) =>
        card.kind === 'full' ? (
          <ChatProductCard
            key={card.product.id}
            product={card.product}
            onNavigate={onNavigate}
          />
        ) : (
          <ChatProductSnippetCard
            key={card.product.id}
            product={card.product}
            onNavigate={onNavigate}
          />
        )
      )}
    </div>
  )
}

function ChatProductCard({
  product,
  onNavigate,
}: {
  product: Product
  onNavigate?: () => void
}) {
  const { locale, t } = useLocale()
  const { addItem } = useCart()
  const { toast } = useToast()
  const saleActive = useSaleActive(product)
  const productName = getProductName(product, locale)
  const priceHuf =
    saleActive && product.discountPriceHuf != null ? product.discountPriceHuf : product.priceHuf
  const hasDiscount = saleActive && product.discountPriceHuf != null
  const productHref = `/products/${product.slug}`
  const canAdd = product.stock !== 0

  const handleAddToCart = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAdd) return
    addItem(product.id, 1, undefined, product)
    toast(t('ai.addedToCart') || t('cart.toastAdded') || 'Termék a kosárban')
  }

  return (
    <div className="rounded-xl bg-background/70 border border-[var(--border)] overflow-hidden">
      <div className="flex gap-2.5 p-2">
        <Link
          href={productHref}
          onClick={onNavigate}
          className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-[var(--border)] focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <ChatProductThumb image={product.image} alt={productName} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={productHref}
            onClick={onNavigate}
            className="text-xs font-medium text-foreground line-clamp-2 leading-snug hover:underline"
          >
            {productName}
          </Link>
          <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
            {hasDiscount && (
              <span className="text-[10px] text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span
              className={`text-xs font-semibold ${hasDiscount ? 'text-discount' : 'text-foreground'}`}
            >
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 px-2 pb-2">
        <Link
          href={productHref}
          onClick={onNavigate}
          className="flex-1 text-center text-[11px] font-medium px-2 py-1.5 rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--border)] transition-colors"
        >
          {t('ai.viewProduct')}
        </Link>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAdd}
          className="flex-1 text-center text-[11px] font-medium px-2 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('buttons.addToCart')}
        </button>
      </div>
    </div>
  )
}

/** Ha a ProductsContext még nem töltötte be a katalógust, az API snippetből is kirajzolható a kártya. */
function ChatProductSnippetCard({
  product,
  onNavigate,
}: {
  product: ChatProductSnippet
  onNavigate?: () => void
}) {
  const { t } = useLocale()
  const { addItem } = useCart()
  const { toast } = useToast()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const productHref = `/products/${product.slug}`
  const priceHuf =
    product.discountPriceHuf != null && product.discountPriceHuf < product.priceHuf
      ? product.discountPriceHuf
      : product.priceHuf
  const hasDiscount =
    product.discountPriceHuf != null && product.discountPriceHuf < product.priceHuf

  const handleAddToCart = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const full =
      getProductByIdFromContext(product.id) ?? getProductByIdFromData(product.id)
    if (full) {
      addItem(full.id, 1, undefined, full)
    } else {
      addItem(product.id, 1, undefined, {
        id: product.id,
        slug: product.slug,
        name: product.name,
        nameEn: product.name,
        priceHuf: product.priceHuf,
        priceEur: Math.round(product.priceHuf / 400),
        discountPriceHuf: product.discountPriceHuf ?? undefined,
        condition: 'Új',
        category: product.category || 'Egyéb',
        image: product.image || '',
        images: product.image ? [product.image] : [],
        stock: -1,
        description: '',
      })
    }
    toast(t('ai.addedToCart') || t('cart.toastAdded') || 'Termék a kosárban')
  }

  return (
    <div className="rounded-xl bg-background/70 border border-[var(--border)] overflow-hidden">
      <div className="flex gap-2.5 p-2">
        <Link
          href={productHref}
          onClick={onNavigate}
          className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-[var(--border)] focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <ChatProductThumb image={product.image} alt={product.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={productHref}
            onClick={onNavigate}
            className="text-xs font-medium text-foreground line-clamp-2 leading-snug hover:underline"
          >
            {product.name}
          </Link>
          <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
            {hasDiscount && (
              <span className="text-[10px] text-muted line-through">
                {product.priceHuf.toLocaleString('hu-HU')} Ft
              </span>
            )}
            <span
              className={`text-xs font-semibold ${hasDiscount ? 'text-discount' : 'text-foreground'}`}
            >
              {priceHuf.toLocaleString('hu-HU')} Ft
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 px-2 pb-2">
        <Link
          href={productHref}
          onClick={onNavigate}
          className="flex-1 text-center text-[11px] font-medium px-2 py-1.5 rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--border)] transition-colors"
        >
          {t('ai.viewProduct')}
        </Link>
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex-1 text-center text-[11px] font-medium px-2 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
        >
          {t('buttons.addToCart')}
        </button>
      </div>
    </div>
  )
}

function ChatProductThumb({ image, alt }: { image?: string; alt: string }) {
  const { t } = useLocale()
  const hasImage = !!image && (image.startsWith('/') || image.startsWith('http'))
  const isLocalImage = !!image?.startsWith('/')

  if (!hasImage || !image) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-muted text-[10px] px-1 text-center">
        {t('product.noImage')}
      </div>
    )
  }

  if (isLocalImage) {
    return <Image src={image} alt={alt} fill className="object-cover" sizes="56px" />
  }

  return (
    <img
      src={image}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover"
      referrerPolicy="no-referrer"
    />
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

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  )
}
