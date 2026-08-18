'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale } from '@/context/LocaleContext'

type Props = {
  frames: string[]
  productName: string
  onClose: () => void
}

export function Product360Viewer({ frames, productName, onClose }: Props) {
  const { t } = useLocale()
  const [frameIndex, setFrameIndex] = useState(0)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startIndex = useRef(0)

  const goPrev = useCallback(() => {
    setFrameIndex((i) => (i <= 0 ? frames.length - 1 : i - 1))
  }, [frames.length])
  const goNext = useCallback(() => {
    setFrameIndex((i) => (i >= frames.length - 1 ? 0 : i + 1))
  }, [frames.length])

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

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startIndex.current = frameIndex
  }
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || frames.length === 0) return
      const delta = e.clientX - startX.current
      const step = 25
      const steps = Math.floor(delta / step)
      const len = frames.length
      const next = ((startIndex.current + steps) % len + len) % len
      setFrameIndex(next)
    },
    [frames.length]
  )
  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const src = frames[frameIndex]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('product.view360')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label={t('buttons.close')}
      >
        <CloseIcon className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); goPrev() }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label={t('product.prevImage')}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); goNext() }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label={t('product.nextImage')}
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <div
        className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {src?.startsWith('/') ? (
          <Image
            src={src}
            alt={`${productName} – 360° ${frameIndex + 1}. kocka`}
            width={800}
            height={800}
            className="max-h-[85vh] w-auto object-contain pointer-events-none"
            draggable={false}
          />
        ) : null}
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/90 text-sm">
        {t('product.view360Hint')}
      </p>
      <p className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 text-white/70 text-xs">
        {frameIndex + 1} / {frames.length}
      </p>
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
