'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { extractRedeemCodeFromScan } from '@/lib/scan-redeem-code'

type Props = {
  open: boolean
  onClose: () => void
  onDetect: (code: string) => void
}

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): {
    detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
  }
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function cameraErrorKey(err: unknown): 'giftClaim.cameraDenied' | 'giftClaim.cameraUnavailable' {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'giftClaim.cameraDenied'
  }
  return 'giftClaim.cameraUnavailable'
}

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
) => { data: string } | null

async function loadJsQr(): Promise<JsQrFn> {
  const mod = (await import('jsqr')) as { default?: JsQrFn }
  const fn = mod.default
  if (typeof fn !== 'function') {
    throw new Error('jsqr_unavailable')
  }
  return fn
}

function decodeQrFromCanvas(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  width: number,
  height: number,
  jsQR: JsQrFn
): string | null {
  const maxSide = 720
  const scale = Math.min(1, maxSide / Math.max(width, height, 1))
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })
  const value = result?.data?.trim()
  return value || null
}

async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('camera_unavailable')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
  } catch (first) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    } catch {
      throw first
    }
  }
}

export function QrCodeScannerModal({ open, onClose, onDetect }: Props) {
  const { t } = useLocale()
  const titleId = useId()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onDetectRef = useRef(onDetect)
  const onCloseRef = useRef(onClose)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  onDetectRef.current = onDetect
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null
    const video = videoRef.current
    const canvas = canvasRef.current
    setErrorKey(null)
    setPhotoBusy(false)

    const emitIfCode = (raw: string | null) => {
      if (cancelled || !raw) return false
      const code = extractRedeemCodeFromScan(raw)
      if (!code) return false
      onDetectRef.current(code)
      return true
    }

    const start = async () => {
      try {
        const jsQR = await loadJsQr()
        if (cancelled) return
        let detector: { detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } | null = null
        try {
          const detectorCtor = getBarcodeDetectorCtor()
          detector = detectorCtor ? new detectorCtor({ formats: ['qr_code'] }) : null
        } catch {
          detector = null
        }
        stream = await openCameraStream()
        if (cancelled) {
          stopStream(stream)
          return
        }
        if (!video) {
          stopStream(stream)
          setErrorKey('giftClaim.cameraUnavailable')
          return
        }
        video.srcObject = stream
        video.muted = true
        video.setAttribute('playsinline', 'true')
        await video.play()

        const tick = async () => {
          if (cancelled || !video) return
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            let detected = false
            if (detector) {
              try {
                const codes = await detector.detect(video)
                detected = emitIfCode(codes[0]?.rawValue ?? null)
              } catch {
                detected = false
                detector = null
              }
            }
            if (detected) return
            if (!detector && canvas) {
              try {
                const decoded = decodeQrFromCanvas(
                  canvas,
                  video,
                  video.videoWidth,
                  video.videoHeight,
                  jsQR
                )
                if (emitIfCode(decoded)) return
              } catch {
                /* keep scanning */
              }
            }
          }
          raf = requestAnimationFrame(() => {
            void tick()
          })
        }

        raf = requestAnimationFrame(() => {
          void tick()
        })
      } catch (err) {
        if (!cancelled) setErrorKey(cameraErrorKey(err))
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopStream(stream)
      if (video) video.srcObject = null
    }
  }, [open])

  if (!open) return null

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoBusy(true)
    setErrorKey(null)
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const detectorCtor = getBarcodeDetectorCtor()
        if (detectorCtor) {
          const detector = new detectorCtor({ formats: ['qr_code'] })
          const codes = await detector.detect(bitmap)
          const code = extractRedeemCodeFromScan(codes[0]?.rawValue ?? '')
          if (code) {
            onDetect(code)
            return
          }
        }
      } catch {
        /* jsQR fallback */
      }
      const canvas = canvasRef.current ?? document.createElement('canvas')
      const jsQR = await loadJsQr()
      const decoded = decodeQrFromCanvas(canvas, bitmap, bitmap.width, bitmap.height, jsQR)
      const code = extractRedeemCodeFromScan(decoded ?? '')
      if (code) {
        onDetect(code)
        return
      }
      setErrorKey('giftClaim.scanEmpty')
    } catch {
      setErrorKey('giftClaim.scanEmpty')
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id={titleId} className="font-heading text-base font-semibold text-foreground">
            {t('giftClaim.scannerTitle')}
          </h3>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[var(--border)]/60 hover:text-foreground"
            onClick={onClose}
            aria-label={t('buttons.close')}
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">{t('giftClaim.scannerHint')}</p>

        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="aspect-square w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-10" aria-hidden>
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-accent" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-accent" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-accent" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-accent" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {errorKey ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {t(errorKey)}
          </p>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void onPickPhoto(e.target.files?.[0])
          }}
        />
        <button
          type="button"
          disabled={photoBusy}
          className="mt-4 w-full rounded-lg border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-accent/50 disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
        >
          {photoBusy ? t('giftClaim.submitting') : t('giftClaim.scanFromPhoto')}
        </button>
      </div>
    </div>
  )
}
