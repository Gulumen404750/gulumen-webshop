'use client'

import { useCallback, useRef, useState } from 'react'
import { cleanCdnUrl, PLACEHOLDER_IMAGE } from '@/lib/cdn'

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
const MAX_SIZE_BYTES = 25 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

const GUIDE_TEXT =
  'Húzd ide a képet, vagy illeszd be a Bunny CDN linket. A rendszer automatikusan formázza a CDN elérést.'

export type CdnImageManagerProps = {
  /** Egy kép (fő kép) – ha multiple=false. */
  value?: string
  onChange?: (url: string) => void
  /** Több kép (galéria / színvariáció). */
  values?: string[]
  onChangeMultiple?: (urls: string[]) => void
  /** Több kép mód. */
  multiple?: boolean
  label?: string
  uploadUrl?: string
  maxSize?: number
  /** Rövid útmutató megjelenítése. */
  showGuide?: boolean
}

export function CdnImageManager({
  value = '',
  onChange,
  values,
  onChangeMultiple,
  multiple = false,
  label,
  uploadUrl = '/api/admin/upload',
  maxSize = MAX_SIZE_BYTES,
  showGuide = true,
}: CdnImageManagerProps) {
  const [pasteValue, setPasteValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const list = multiple ? (values ?? []) : value ? [value] : []

  const clearFeedback = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const markBroken = useCallback((url: string) => {
    setBrokenUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }))
    const isCdn = /b-cdn\.net|bunnycdn\.com/i.test(url)
    setError(
      isCdn
        ? 'A CDN kép nem tölthető be. Ellenőrizd a Bunny Pull Zone-t (gulumen.b-cdn.net ne legyen suspended/not configured), és hogy a fájl pathja helyes-e (ne tartalmazza a storage zone nevét kétszer).'
        : 'A kép nem tölthető be. Ellenőrizd az URL-t.'
    )
  }, [])

  const applyUrl = useCallback(
    (raw: string) => {
      const cleaned = cleanCdnUrl(raw)
      if (!cleaned) {
        setError('Érvénytelen vagy üres kép URL.')
        return
      }
      if (multiple && onChangeMultiple) {
        onChangeMultiple([...(values ?? []), cleaned])
        setSuccess('Kép hozzáadva.')
      } else if (onChange) {
        onChange(cleaned)
        setSuccess('Kép beállítva.')
      }
      setPasteValue('')
    },
    [multiple, onChange, onChangeMultiple, values]
  )

  const removeAt = useCallback(
    (index: number) => {
      clearFeedback()
      if (multiple && onChangeMultiple) {
        onChangeMultiple((values ?? []).filter((_, i) => i !== index))
      } else if (onChange) {
        onChange('')
      }
    },
    [clearFeedback, multiple, onChange, onChangeMultiple, values]
  )

  const validateFile = useCallback(
    (file: File): string | null => {
      const type = (file.type || '').toLowerCase()
      const allowedByType = ALLOWED_TYPES.some((t) => t === type || (type === 'image/jpeg' && t === 'image/jpg'))
      const allowedByExt =
        !type || type === 'application/octet-stream'
          ? /\.(jpe?g|png|webp|gif)$/i.test(file.name || '')
          : false
      if (!allowedByType && !allowedByExt) {
        return 'Csak JPG, PNG, WebP vagy GIF tölthető fel.'
      }
      if (file.size > maxSize) {
        return `A fájl mérete legfeljebb ${Math.round(maxSize / 1024 / 1024)} MB lehet.`
      }
      return null
    },
    [maxSize]
  )

  const uploadFile = useCallback(
    async (file: File) => {
      clearFeedback()
      const err = validateFile(file)
      if (err) {
        setError(err)
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(uploadUrl, { method: 'POST', credentials: 'include', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          let hint = ''
          if (res.status === 401) hint = ' Jelentkezz be az adminba.'
          setError((data?.error || 'Feltöltés sikertelen.') + hint)
          return
        }
        const url = typeof data.url === 'string' ? cleanCdnUrl(data.url) : ''
        if (!url) {
          setError('A szerver nem adott vissza képcímet.')
          return
        }
        if (multiple && onChangeMultiple) {
          onChangeMultiple([...(values ?? []), url])
          setSuccess('Kép feltöltve és hozzáadva.')
        } else if (onChange) {
          onChange(url)
          setSuccess('Kép feltöltve.')
        }
        if (inputRef.current) inputRef.current.value = ''
      } catch {
        setError('Hálózati hiba. Próbáld újra.')
      } finally {
        setUploading(false)
      }
    },
    [clearFeedback, validateFile, uploadUrl, multiple, onChange, onChangeMultiple, values]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      // Először fájl
      const file = e.dataTransfer?.files?.[0]
      if (file) {
        uploadFile(file)
        return
      }
      // Szöveg / URL húzás
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain')
      if (text?.trim()) {
        clearFeedback()
        applyUrl(text.trim())
      }
    },
    [uploadFile, applyUrl, clearFeedback]
  )

  const handlePasteInput = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text')?.trim()
      if (text && (text.startsWith('http') || text.includes('bunnycdn') || text.includes('b-cdn.net'))) {
        e.preventDefault()
        clearFeedback()
        applyUrl(text)
      }
    },
    [applyUrl, clearFeedback]
  )

  const handleZonePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData('text')?.trim()
      if (text && (text.startsWith('http') || text.includes('b-cdn') || text.includes('bunny'))) {
        e.preventDefault()
        clearFeedback()
        applyUrl(text)
        return
      }
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) uploadFile(file)
          return
        }
      }
    },
    [applyUrl, clearFeedback, uploadFile]
  )

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}

      {showGuide && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground">
          {GUIDE_TEXT}
        </p>
      )}

      {/* Előnézet lista */}
      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden"
            >
              <div className="relative w-full aspect-[4/3] max-h-[220px] bg-[var(--border)]/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brokenUrls[url] ? PLACEHOLDER_IMAGE : url || PLACEHOLDER_IMAGE}
                  alt={`Kép ${i + 1}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => markBroken(url)}
                />
                {brokenUrls[url] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-3 text-center text-xs text-white">
                    CDN kép nem elérhető
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <p className="flex-1 text-xs text-muted truncate" title={url}>
                  {url}
                </p>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="shrink-0 rounded-lg border border-red-500/50 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                >
                  Törlés
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Drag & drop + paste zóna */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onPaste={handleZonePaste}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          dragOver
            ? 'border-accent bg-accent/10'
            : 'border-[var(--border)] hover:border-accent/50 hover:bg-[var(--border)]/10'
        }`}
        aria-label="Képkezelő: húzd ide a fájlt vagy illeszd be a CDN linket"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadFile(file)
            e.target.value = ''
          }}
          disabled={uploading}
        />
        {uploading ? (
          <p className="text-sm font-medium text-foreground">Feltöltés…</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Húzd ide a képet, vagy{' '}
              <span className="text-foreground font-medium">kattints a fájl kiválasztásához</span>
            </p>
            <p className="text-xs text-muted mt-1">
              JPG, PNG, WebP, GIF — max {Math.round(maxSize / 1024 / 1024)} MB · Paste: Ctrl/⌘+V
            </p>
          </>
        )}
      </div>

      {/* CDN link beillesztés (nem külön manuális HTTP galéria-sor) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          onPaste={handlePasteInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              clearFeedback()
              if (pasteValue.trim()) applyUrl(pasteValue.trim())
            }
          }}
          placeholder="Bunny CDN link beillesztése…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
        />
        <button
          type="button"
          onClick={() => {
            clearFeedback()
            if (pasteValue.trim()) applyUrl(pasteValue.trim())
          }}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Link hozzáadása
        </button>
      </div>

      {success && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
