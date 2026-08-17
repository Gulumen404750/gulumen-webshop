'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanCdnUrl, PLACEHOLDER_IMAGE } from '@/lib/cdn'

const ACCEPT = 'image/*'
const MAX_SIZE_BYTES = 25 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]

const GUIDE_TEXT =
  'Húzd ide a képet, vagy illeszd be a Bunny CDN / külső https linket. Mentéskor a külső képeket a szerver letölti, WebP-re alakítja, és a saját CDN-re (gulumen.b-cdn.net) menti.'

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

type PreviewItem = { url: string; local?: boolean }

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
  const [pendingPreviews, setPendingPreviews] = useState<PreviewItem[]>([])
  const blobUrlsRef = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const list = multiple ? (values ?? []) : value ? [value] : []

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [])

  const rememberBlob = (url: string) => {
    blobUrlsRef.current.push(url)
  }

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
      const allowedByType =
        !type ||
        type === 'application/octet-stream' ||
        type.startsWith('image/') ||
        ALLOWED_TYPES.some((t) => t === type)
      const allowedByExt = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name || '')
      if (!allowedByType && !allowedByExt) {
        return 'Csak kép fájl csatolható (JPG, PNG, WebP, GIF, AVIF, HEIC).'
      }
      if (file.size > maxSize) {
        return `A fájl mérete legfeljebb ${Math.round(maxSize / 1024 / 1024)} MB lehet.`
      }
      if (file.size === 0) {
        return 'A csatolt fájl üres – próbáld újra, vagy mentsd JPG/PNG-ként.'
      }
      return null
    },
    [maxSize]
  )

  const uploadOneFile = useCallback(
    async (file: File): Promise<string | null> => {
      const err = validateFile(file)
      if (err) {
        setError(err)
        return null
      }
      const blobUrl = URL.createObjectURL(file)
      rememberBlob(blobUrl)
      setPendingPreviews((prev) =>
        multiple ? [...prev, { url: blobUrl, local: true }] : [{ url: blobUrl, local: true }]
      )

      const form = new FormData()
      form.append('file', file, file.name || 'image.jpg')
      const res = await fetch(uploadUrl, { method: 'POST', credentials: 'include', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let hint = ''
        if (res.status === 401) hint = ' Jelentkezz be az adminba.'
        if (res.status === 413) hint = ' A fájl túl nagy a szerver limitjéhez képest.'
        setError((data?.error || 'Feltöltés sikertelen.') + hint)
        setPendingPreviews((prev) => prev.filter((p) => p.url !== blobUrl))
        return null
      }
      const url = typeof data.url === 'string' ? cleanCdnUrl(data.url) : ''
      if (!url) {
        setError('A szerver nem adott vissza képcímet.')
        setPendingPreviews((prev) => prev.filter((p) => p.url !== blobUrl))
        return null
      }
      setPendingPreviews((prev) => prev.filter((p) => p.url !== blobUrl))
      return url
    },
    [multiple, uploadUrl, validateFile]
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      clearFeedback()
      setUploading(true)
      try {
        const toUpload = multiple ? files : files.slice(0, 1)
        const uploaded: string[] = []
        for (const file of toUpload) {
          const url = await uploadOneFile(file)
          if (url) uploaded.push(url)
        }
        if (uploaded.length === 0) return
        if (multiple && onChangeMultiple) {
          onChangeMultiple([...(values ?? []), ...uploaded])
          setSuccess(
            uploaded.length > 1 ? `${uploaded.length} kép feltöltve.` : 'Kép feltöltve és hozzáadva.'
          )
        } else if (onChange) {
          onChange(uploaded[0])
          setSuccess('Kép feltöltve.')
        }
        if (inputRef.current) inputRef.current.value = ''
      } catch {
        setError('Hálózati hiba. Próbáld újra – a csatolás nem ment át.')
      } finally {
        setUploading(false)
      }
    },
    [clearFeedback, multiple, onChange, onChangeMultiple, uploadOneFile, values]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const dropped = Array.from(e.dataTransfer?.files ?? [])
      if (dropped.length > 0) {
        void uploadFiles(dropped)
        return
      }
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain')
      if (text?.trim()) {
        clearFeedback()
        applyUrl(text.trim())
      }
    },
    [uploadFiles, applyUrl, clearFeedback]
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
      const items = e.clipboardData.items
      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        void uploadFiles(imageFiles)
        return
      }
      const text = e.clipboardData.getData('text')?.trim()
      if (text && (text.startsWith('http') || text.includes('b-cdn') || text.includes('bunny'))) {
        e.preventDefault()
        clearFeedback()
        applyUrl(text)
      }
    },
    [applyUrl, clearFeedback, uploadFiles]
  )

  const displayList: PreviewItem[] = [...list.map((url) => ({ url })), ...pendingPreviews]

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}

      {showGuide && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground">
          {GUIDE_TEXT}
        </p>
      )}

      {displayList.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {displayList.map((item, i) => (
            <li
              key={`${item.url}-${i}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden"
            >
              <div className="relative w-full aspect-[4/3] max-h-[220px] bg-[var(--border)]/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brokenUrls[item.url] ? PLACEHOLDER_IMAGE : item.url || PLACEHOLDER_IMAGE}
                  alt={`Kép ${i + 1}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (!item.local) markBroken(item.url)
                  }}
                />
                {item.local && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-center text-xs text-white">
                    Feltöltés…
                  </div>
                )}
                {brokenUrls[item.url] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-3 text-center text-xs text-white">
                    CDN kép nem elérhető
                  </div>
                )}
              </div>
              {!item.local && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <p className="flex-1 text-xs text-muted truncate" title={item.url}>
                    {item.url}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="shrink-0 rounded-lg border border-red-500/50 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                  >
                    Törlés
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onPaste={handleZonePaste}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragOver
            ? 'border-accent bg-accent/10'
            : 'border-[var(--border)] hover:border-accent/50 hover:bg-[var(--border)]/10'
        }`}
      >
        {/*
          iOS Safari: display:none file input + .click() gyakran NEM nyitja meg a választót.
          Overlay input (opacity 0) a megbízható csatolás.
        */}
        <label className="relative z-10 block min-h-[4.5rem] cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple={multiple}
            className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) void uploadFiles(files)
              e.target.value = ''
            }}
            disabled={uploading}
            aria-label="Kép csatolása"
          />
          {uploading ? (
            <p className="pointer-events-none text-sm font-medium text-foreground">
              Feltöltés… a csatolt kép előnézete hamarosan megjelenik.
            </p>
          ) : (
            <>
              <p className="pointer-events-none text-sm text-muted">
                Húzd ide a képet, vagy{' '}
                <span className="font-medium text-foreground">koppints a fájl csatolásához</span>
              </p>
              <p className="pointer-events-none mt-1 text-xs text-muted">
                JPG, PNG, WebP, GIF, HEIC — max {Math.round(maxSize / 1024 / 1024)} MB · Paste: Ctrl/⌘+V
              </p>
            </>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
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
          className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
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
