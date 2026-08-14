'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { applyCspNonceToScript } from '@/lib/csp-nonce-browser'

const MODEL_VIEWER_SCRIPT = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js'

/** Model-viewer element típusa (model API a betöltés után). */
interface ModelViewerElement extends HTMLElement {
  model?: {
    materials?: Array<{
      pbrMetallicRoughness?: { setBaseColorFactor: (v: string | number[]) => void }
    }>
  }
}

function applyMaterialColor(viewer: ModelViewerElement | null, hex: string | undefined) {
  if (!viewer?.model?.materials?.length || !hex) return
  const mat = viewer.model.materials[0]
  if (mat?.pbrMetallicRoughness) {
    try {
      mat.pbrMetallicRoughness.setBaseColorFactor(hex)
    } catch {
      // ignore
    }
  }
}

type Props = {
  src: string
  alt: string
  className?: string
  /** Hex szín (pl. #c41e3a); ha megadva, az első material base color-át állítja. */
  selectedColorHex?: string
  /** Teljes képernyős gomb megjelenítése. */
  enableFullscreen?: boolean
  /** Mobil asztali-tip hint (pl. beágyazott teljes képernyős nézetben kapcsold ki). */
  showMobileHint?: boolean
  /** Betöltés után (szín alkalmazása előtt is meghívódik). */
  onLoaded?: () => void
}

export function ProductModelViewer({ src, alt, className = '', selectedColorHex, enableFullscreen = false, showMobileHint = true, onLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ModelViewerElement | null>(null)
  const loadingRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelError, setModelError] = useState(false)
  const [showSlowLoadingHint, setShowSlowLoadingHint] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const { t } = useLocale()

  useEffect(() => {
    if (typeof document === 'undefined' || !containerRef.current) return
    const existing = document.querySelector('script[src="' + MODEL_VIEWER_SCRIPT + '"]')
    const onReady = () => {
      if (customElements.get('model-viewer')) {
        setReady(true)
        return
      }
      customElements.whenDefined('model-viewer').then(() => setReady(true))
    }
    if (existing) {
      onReady()
      return
    }
    const script = document.createElement('script')
    script.type = 'module'
    script.src = MODEL_VIEWER_SCRIPT
    applyCspNonceToScript(script)
    script.onload = onReady
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!ready || !containerRef.current) return
    setModelError(false)
    setShowSlowLoadingHint(false)
    setModelLoaded(false)
    loadingRef.current = true

    const srcTrimmed = (src || '').trim()
    const modelUrl = srcTrimmed.startsWith('http') ? srcTrimmed : `${window.location.origin}${srcTrimmed.startsWith('/') ? '' : '/'}${srcTrimmed}`

    let cancelled = false
    let loadFired = false

    fetch(modelUrl, { method: 'GET', cache: 'no-store' })
      .then((r) => {
        if (cancelled) return
        if (!r.ok) setModelError(true)
      })
      .catch(() => {
        if (cancelled) return
      })

    // Csak akkor mutatjuk a "Nagy modell…" üzenetet, ha 2–3 mp után még tényleg tölt
    const SLOW_HINT_DELAY_MS = 3000
    const slowTimer = window.setTimeout(() => {
      if (cancelled) return
      if (loadingRef.current) setShowSlowLoadingHint(true)
    }, SLOW_HINT_DELAY_MS)
    const failTimer = window.setTimeout(() => {
      if (cancelled || loadFired) return
      setModelError(true)
    }, 18000)

    const el = document.createElement('model-viewer') as ModelViewerElement
    el.setAttribute('src', modelUrl)
    el.setAttribute('alt', alt)
    el.setAttribute('camera-controls', '')
    el.setAttribute('touch-action', 'pan-y')
    el.setAttribute('shadow-intensity', '0.8')
    el.setAttribute('auto-rotate', '')
    // Tall phone-case models: pull camera back + wider FOV so top/bottom are not clipped on mobile.
    el.setAttribute('camera-orbit', '0deg 75deg 105%')
    el.setAttribute('min-camera-orbit', 'auto auto 90%')
    el.setAttribute('max-camera-orbit', 'auto auto 300%')
    el.setAttribute('field-of-view', '55deg')
    el.setAttribute('min-field-of-view', '25deg')
    el.setAttribute('max-field-of-view', '70deg')
    el.setAttribute('interaction-prompt', 'auto')
    el.setAttribute('exposure', '1')
    el.setAttribute('environment-image', 'neutral')
    el.setAttribute('style', 'width: 100%; height: 100%; background: transparent;')

    const onLoad = () => {
      loadFired = true
      loadingRef.current = false
      setModelError(false)
      setShowSlowLoadingHint(false)
      setModelLoaded(true)
      viewerRef.current = el
      const anyEl = el as ModelViewerElement & { updateFraming?: () => void }
      try {
        anyEl.updateFraming?.()
      } catch {
        // ignore
      }
      applyMaterialColor(el, selectedColorHex)
      onLoaded?.()
    }
    const onError = () => {
      loadingRef.current = false
      setShowSlowLoadingHint(false)
      setModelError(true)
    }

    el.addEventListener('load', onLoad)
    el.addEventListener('error', onError)

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(el)
    viewerRef.current = el

    return () => {
      cancelled = true
      loadingRef.current = false
      viewerRef.current = null
      clearTimeout(slowTimer)
      clearTimeout(failTimer)
      el.removeEventListener('load', onLoad)
      el.removeEventListener('error', onError)
      containerRef.current?.replaceChildren()
    }
  }, [ready, src, alt])

  // Szín frissítése betöltés után (pl. felhasználó betöltés előtt választott színt)
  useEffect(() => {
    if (!modelLoaded || !selectedColorHex) return
    applyMaterialColor(viewerRef.current, selectedColorHex)
  }, [modelLoaded, selectedColorHex])

  const srcTrimmed = (src || '').trim()
  const attemptedUrl = typeof window !== 'undefined' && srcTrimmed ? (srcTrimmed.startsWith('http') ? srcTrimmed : `${window.location.origin}${srcTrimmed.startsWith('/') ? '' : '/'}${srcTrimmed}`) : ''

  const renderViewerArea = useCallback(
    (isFullscreen = false) => (
      <div className={isFullscreen ? 'relative w-full h-full min-h-[60vh]' : 'absolute inset-0'}>
        <div
          ref={isFullscreen ? undefined : containerRef}
          className="absolute inset-0 w-full h-full"
        />
        {enableFullscreen && !isFullscreen && (
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            className="absolute top-2 right-2 z-10 flex w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/90 text-foreground items-center justify-center hover:bg-[var(--border)] transition-colors shadow-sm"
            aria-label={t('product.fullscreen3D') || 'Nagyítás / Teljes képernyő'}
            title={t('product.fullscreen3D') || 'Nagyítás'}
          >
            <ExpandIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    ),
    [enableFullscreen, t]
  )

  if (modelError) {
    return (
      <div className={`${className} min-h-[280px] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <span className="text-destructive font-medium">{t('product.modelLoadError')}</span>
        <p className="text-sm text-muted max-w-sm">{t('product.modelLoadErrorHint')}</p>
        {process.env.NODE_ENV === 'development' && attemptedUrl ? (
          <p className="text-xs text-muted max-w-md break-all">
            URL:{' '}
            <a href={attemptedUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {attemptedUrl}
            </a>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className={`${className} relative w-full h-full`}>
        {renderViewerArea(false)}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-muted">
            {t('product.loadingModel') || '3D modell betöltése…'}
          </div>
        )}
        {ready && showSlowLoadingHint && (
          <div className="absolute bottom-2 left-2 right-2 z-10 text-center text-sm text-muted bg-[var(--card-bg)]/90 rounded py-1">
            {t('product.modelStillLoading')}
          </div>
        )}
      </div>

      {showMobileHint && (
        <div className="md:hidden mt-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-center space-y-2">
          <p className="text-sm text-muted leading-relaxed">{t('product.view3DMobileHint')}</p>
          {enableFullscreen && (
            <button
              type="button"
              onClick={() => setFullscreenOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground text-sm font-medium hover:bg-[var(--border)] transition-colors"
            >
              <ExpandIcon className="w-4 h-4 shrink-0" aria-hidden />
              {t('product.openFullscreen3D')}
            </button>
          )}
        </div>
      )}

      {fullscreenOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('product.fullscreen3D') || '3D megtekintés – teljes képernyő'}
        >
          <div className="w-full max-w-4xl h-[80vh] min-h-[320px] rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] flex flex-col">
            <div className="flex justify-end p-2 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setFullscreenOpen(false)}
                className="p-2 rounded-lg text-foreground hover:bg-[var(--border)] transition-colors"
                aria-label={t('buttons.close') || 'Bezárás'}
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ProductModelViewer
                src={src}
                alt={alt}
                selectedColorHex={selectedColorHex}
                className="absolute inset-0"
                showMobileHint={false}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            className="mt-4 px-6 py-2 rounded-lg bg-[var(--card-bg)] text-foreground border border-[var(--border)] hover:bg-[var(--border)]"
          >
            {t('buttons.close') || 'Bezárás'}
          </button>
        </div>
      )}
    </>
  )
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
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
