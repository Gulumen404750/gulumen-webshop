'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'

const FROG_SIZE = 64
const FROG_SPEED = 1.2
const FALL_SPEED = 9
const BOTTOM_OFFSET = 24
const EDGE_MARGIN = 32

function getGroundY() {
  if (typeof window === 'undefined') return 400
  return window.innerHeight - BOTTOM_OFFSET - FROG_SIZE / 2
}

export default function ContactPage() {
  const [frogPos, setFrogPos] = useState<{ x: number; y: number } | null>(null)
  const [facingLeft, setFacingLeft] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [falling, setFalling] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const directionRef = useRef(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (frogPos !== null) return
    const y = typeof window !== 'undefined' ? window.innerHeight - BOTTOM_OFFSET - FROG_SIZE / 2 : 400
    const x = typeof window !== 'undefined' ? window.innerWidth - EDGE_MARGIN - FROG_SIZE / 2 : 300
    setFrogPos({ x, y })
    directionRef.current = 1
    setFacingLeft(true)
  }, [frogPos])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!frogPos) return
    setDragging(true)
    dragOffset.current = { x: e.clientX - frogPos.x, y: e.clientY - frogPos.y }
  }, [frogPos])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!frogPos) return
    setDragging(true)
    const t = e.touches[0]
    dragOffset.current = { x: t.clientX - frogPos.x, y: t.clientY - frogPos.y }
  }, [frogPos])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setFrogPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const t = e.touches[0]
      setFrogPos({ x: t.clientX - dragOffset.current.x, y: t.clientY - dragOffset.current.y })
    }
    const onEnd = () => {
      setDragging(false)
      setFalling(true)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [dragging])

  useEffect(() => {
    if (!falling || frogPos === null) return
    const groundY = getGroundY()
    let raf = 0
    const tick = () => {
      setFrogPos((prev) => {
        if (!prev) return prev
        if (prev.y >= groundY) {
          setFalling(false)
          return { ...prev, y: groundY }
        }
        return { ...prev, y: Math.min(prev.y + FALL_SPEED, groundY) }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [falling])

  useEffect(() => {
    if (dragging || falling || frogPos === null) return
    let raf = 0
    const tick = () => {
      setFrogPos((prev) => {
        if (!prev) return prev
        const maxX = typeof window !== 'undefined' ? window.innerWidth - EDGE_MARGIN - FROG_SIZE / 2 : 800
        const minX = EDGE_MARGIN + FROG_SIZE / 2
        const dir = directionRef.current
        let nextX = prev.x + dir * FROG_SPEED
        if (nextX >= maxX) {
          nextX = maxX
          directionRef.current = -1
          setFacingLeft(false)
        } else if (nextX <= minX) {
          nextX = minX
          directionRef.current = 1
          setFacingLeft(true)
        }
        return { ...prev, x: nextX }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragging, falling, frogPos === null])

  return (
    <div ref={containerRef} className="relative min-h-[70vh] flex items-center">
      {/* Statikus háttérkép – nincs mozgó vagy interaktív elem */}
      <div className="absolute inset-0 min-h-[400px] overflow-hidden">
        <Image
          src="/img/kapcsolat-ai-robot.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pointer-events-none" aria-hidden />
      </div>

      {/* Zöld béka: ejtéskor meglepődik, esik a talajra, majd boldogan ugrál */}
      {frogPos && (
        <div
          className={`fixed z-20 w-16 h-16 flex flex-col items-center justify-center select-none cursor-grab active:cursor-grabbing touch-none ${
            dragging ? '' : falling ? 'frog-fall' : 'frog-jump'
          }`}
          style={{
            left: frogPos.x - FROG_SIZE / 2,
            top: frogPos.y - FROG_SIZE / 2,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="img"
          aria-label="Dekoratív béka – húzd el a helyére"
        >
          {falling && (
            <span className="text-xl font-bold text-amber-200 drop-shadow-md animate-pulse -mt-1" aria-hidden>
              !!
            </span>
          )}
          <span
            className={`text-6xl drop-shadow-lg inline-block ${falling ? 'frog-surprised' : ''}`}
            style={{
              filter: 'hue-rotate(0deg) saturate(1.2)',
              transform: `scaleX(${facingLeft ? 1 : -1}) perspective(120px) rotateY(${facingLeft ? '-12deg' : '12deg'})`,
            }}
          >
            🐸
          </span>
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-6 drop-shadow-lg">
          Kapcsolat
        </h1>
        <div className="text-gray-200 space-y-4 max-w-2xl drop-shadow">
          <p>
            Kérdésed vagy panaszod van? Használd az oldal jobb alsó sarkában lévő <strong className="text-white">„Kérdésed van? Segítek!”</strong> gombot – az AI ügyfélszolgálat magyarul, angolul és németül válaszol.
          </p>
          <p>
            Ha emberi ügyintézőt szeretnél (pl. panasz, jogi ügy), a chatben kérj ügy átadását – add meg a rendelés azonosítót és e-mail címedet.
          </p>
          <p>
            E-mail: <a href="mailto:info@gulumen.hu" className="text-accent hover:underline font-medium">info@gulumen.hu</a>
          </p>
        </div>
      </div>
    </div>
  )
}
