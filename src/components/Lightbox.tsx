'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale } from '@/context/LocaleContext'

const MIN_SCALE = 1
const MAX_SCALE = 3

type Props = {
  images: string[]
  productName: string
  currentIndex: number
  onClose: () => void
  onIndexChange: (i: number) => void
}

export function Lightbox({ images, productName, currentIndex, onClose, onIndexChange }: Props) {
  const { t } = useLocale()
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const goPrev = useCallback(() => {
    onIndexChange(currentIndex <= 0 ? images.length - 1 : currentIndex - 1)
  }, [currentIndex, images.length, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange(currentIndex >= images.length - 1 ? 0 : currentIndex + 1)
  }, [currentIndex, images.length, onIndexChange])

  // Reset zoom/pan when changing image
  useEffect(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [currentIndex])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goPrev, goNext])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const zoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((s) => Math.min(MAX_SCALE, s + 0.5))
  }, [])
  const zoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((s) => Math.max(MIN_SCALE, s - 0.5))
  }, [])
  const resetZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (e.deltaY < 0) setScale((s) => Math.min(MAX_SCALE, s + 0.2))
      else setScale((s) => Math.max(MIN_SCALE, s - 0.2))
    },
    []
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return
      e.preventDefault()
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y }
    },
    [scale, translate]
  )
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || scale <= 1) return
      setTranslate({
        x: dragStart.current.tx + (e.clientX - dragStart.current.x),
        y: dragStart.current.ty + (e.clientY - dragStart.current.y),
      })
    },
    [isDragging, scale]
  )
  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const src = images[currentIndex]
  const hasMultiple = images.length > 1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('product.gallery') || 'Képgaléria'}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label={t('buttons.close') || 'Bezárás'}
      >
        <CloseIcon className="w-6 h-6" />
      </button>

      {/* Zoom controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-white/10 p-1">
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="p-2 rounded-full text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label={t('product.zoomOut') || 'Kicsinyítés'}
        >
          <ZoomOutIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="px-2 py-1 text-white text-sm font-medium min-w-[3rem] hover:bg-white/20 rounded transition-colors"
          aria-label={t('product.zoomReset') || 'Eredeti méret'}
          title={t('product.zoomReset') || 'Eredeti méret'}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="p-2 rounded-full text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label={t('product.zoomIn') || 'Nagyítás'}
        >
          <ZoomInIcon className="w-5 h-5" />
        </button>
      </div>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={t('product.prevImage') || 'Előző'}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={t('product.nextImage') || 'Következő'}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div
        ref={containerRef}
        className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in' }}
      >
        {src && (src.startsWith('/') || src.startsWith('http')) ? (
          <div
            className="transition-transform duration-150 select-none"
            style={{
              transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
            }}
          >
            {src.startsWith('/') ? (
              <Image
                src={src}
                alt={`${productName} – ${currentIndex + 1}. kép`}
                width={1200}
                height={1200}
                className="max-h-[85vh] w-auto object-contain pointer-events-none"
                unoptimized={src.startsWith('/uploads/')}
                draggable={false}
              />
            ) : (
              <img
                src={src}
                alt={`${productName} – ${currentIndex + 1}. kép`}
                className="max-h-[85vh] w-auto object-contain pointer-events-none"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        ) : null}
      </div>

      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
function ZoomInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
    </svg>
  )
}
function ZoomOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
    </svg>
  )
}
