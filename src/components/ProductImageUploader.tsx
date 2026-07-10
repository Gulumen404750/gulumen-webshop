'use client'

import { useCallback, useState, useRef } from 'react'
import Image from 'next/image'

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

export type ProductImageUploaderProps = {
  /** Current image URL (product.image). After upload this is set to the returned url. */
  value: string
  /** Called when a new URL is set (after successful upload or manual change). */
  onChange: (url: string) => void
  /** Upload API endpoint. */
  uploadUrl?: string
  /** Max file size in bytes. */
  maxSize?: number
  /** Label above the area. */
  label?: string
  /** Show a text input for manual URL (paste link). */
  showUrlInput?: boolean
  /** Placeholder for URL input. */
  urlPlaceholder?: string
  /** For gallery: called with the new URL when upload succeeds, without changing value (e.g. add to images array). */
  onAddUrl?: (url: string) => void
  /** If true, upload adds to gallery instead of replacing main image (onAddUrl is used). */
  mode?: 'single' | 'add'
}

export function ProductImageUploader({
  value,
  onChange,
  uploadUrl = '/api/admin/upload',
  maxSize = MAX_SIZE_BYTES,
  label = 'Fő kép',
  showUrlInput = true,
  urlPlaceholder = 'https://… vagy húzd ide / kattints a feltöltéshez',
  onAddUrl,
  mode = 'single',
}: ProductImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null) // local blob before upload
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayUrl = value || previewUrl

  const clearFeedback = useCallback(() => {
    setError(null)
    setSuccessMessage(null)
  }, [])

  const validateFile = useCallback(
    (file: File): string | null => {
      const type = (file.type || '').toLowerCase()
      const allowedByType = ALLOWED_TYPES.some((t) => t === type || (type === 'image/jpeg' && t === 'image/jpg'))
      const allowedByExt =
        !type || type === 'application/octet-stream'
          ? /\.(jpe?g|png|webp|gif)$/i.test(file.name || '')
          : false
      if (!allowedByType && !allowedByExt) {
        return 'Csak JPG, JPEG, PNG, WebP vagy GIF tölthető fel. ChatGPT/Gemini képet mentsd PNG-ként, majd töltsd fel.'
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

      const blobUrl = URL.createObjectURL(file)
      setPreviewUrl(blobUrl)
      setUploading(true)
      setUploadProgress(0)

      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(uploadUrl, { method: 'POST', credentials: 'include', body: form })
        const data = await res.json().catch(() => ({}))
        setUploadProgress(100)

        if (!res.ok) {
          const msg = data?.error || 'Feltöltés sikertelen.'
          let hint = ''
          if (res.status === 401) {
            hint = ' Jelentkezz be az adminba: Gulumen Admin → belépés API kulccsal.'
          } else if (res.status === 400 || res.status === 500) {
            hint =
              ' Lehet Windows blokk (Tulajdonságok → Engedélyezés), vagy rossz formátum – csak JPG/PNG/WebP/GIF.'
          }
          setError(msg + hint)
          setPreviewUrl(null)
          return
        }

        const url = data.url
        if (typeof url !== 'string' || !url) {
          setError('A szerver nem adott vissza képcímet.')
          setPreviewUrl(null)
          return
        }

        setPreviewUrl(null)
        if (mode === 'add' && onAddUrl) {
          onAddUrl(url)
          setSuccessMessage('Kép hozzáadva a galériához.')
        } else {
          onChange(url)
          setSuccessMessage('Kép feltöltve.')
        }
        if (inputRef.current) inputRef.current.value = ''
      } catch {
        setError('Hálózati hiba. Próbáld újra.')
        setPreviewUrl(null)
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
    },
    [uploadUrl, validateFile, onChange, mode, onAddUrl, clearFeedback]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const file = e.dataTransfer?.files?.[0]
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadFile(file)
      e.target.value = ''
    },
    [uploadFile]
  )

  const handleClick = useCallback(() => {
    clearFeedback()
    inputRef.current?.click()
  }, [clearFeedback])

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Preview: current image or just-uploaded preview */}
      {displayUrl && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="relative w-full aspect-[4/3] max-h-[280px] bg-[var(--border)]/30">
            {displayUrl.startsWith('blob:') ? (
              <img
                src={displayUrl}
                alt="Előnézet"
                className="w-full h-full object-contain"
              />
            ) : displayUrl.startsWith('/') ? (
              <Image
                src={displayUrl}
                alt="Termék kép"
                fill
                className="object-contain"
                sizes="(max-width: 400px) 100vw, 400px"
                unoptimized={displayUrl.startsWith('/uploads/')}
              />
            ) : (
              <img
                src={displayUrl}
                alt="Termék kép"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          {value && (
            <p className="text-xs text-muted px-3 py-2 truncate" title={value}>
              {value}
            </p>
          )}
        </div>
      )}

      {/* Drag & drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-[var(--border)]/10 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
        aria-label="Kép feltöltése: húzd ide vagy kattints"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Feltöltés…</p>
            <div className="h-2 w-full max-w-xs mx-auto rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Húzd ide a képet, vagy <span className="text-foreground font-medium">kattints a fájl kiválasztásához</span>
            </p>
            <p className="text-xs text-muted mt-1">
              JPG, PNG, WebP, GIF — max {Math.round(maxSize / 1024 / 1024)} MB
            </p>
          </>
        )}
      </div>

      {/* Success / Error */}
      {successMessage && (
        <p className="text-sm text-green-600 dark:text-green-400" role="status">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Optional URL input */}
      {showUrlInput && (
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Kép URL (kézi beillesztés)</label>
          <input
            type="url"
            value={value}
            onChange={(e) => {
              clearFeedback()
              onChange(e.target.value)
            }}
            placeholder={urlPlaceholder}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
          />
        </div>
      )}
    </div>
  )
}
