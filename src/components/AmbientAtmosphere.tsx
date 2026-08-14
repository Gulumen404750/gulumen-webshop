'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 8) % 94}%`,
  top: `${(i * 53 + 11) % 92}%`,
  delay: `${((i * 0.73) % 9).toFixed(2)}s`,
  duration: `${12 + (i % 7)}s`,
  size: i % 4 === 0 ? 3 : 2,
}))

/**
 * Storefront-only ambient layer: slow gradient orbs, faint sparkles,
 * and (on fine pointers) a cursor-following navy/gold glow.
 * GPU-only transforms; skipped on reduced motion, /admin, and /termekek (video bg).
 */
export function AmbientAtmosphere() {
  const pathname = usePathname()
  const glowRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -400, y: -400, tx: -400, ty: -400 })
  const raf = useRef(0)
  const [motionOk, setMotionOk] = useState(false)
  const [cursorOn, setCursorOn] = useState(false)

  const isAdmin = pathname?.startsWith('/admin') ?? false
  const isProducts = pathname === '/termekek' || (pathname?.startsWith('/termekek?') ?? false)

  useEffect(() => {
    if (isAdmin || isProducts) {
      setMotionOk(false)
      setCursorOn(false)
      return
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(pointer: fine)')
    const hover = window.matchMedia('(hover: hover)')

    const sync = () => {
      const allowMotion = !reduce.matches
      setMotionOk(allowMotion)
      setCursorOn(allowMotion && fine.matches && hover.matches)
    }

    const onVisibility = () => {
      document.documentElement.classList.toggle('ambient-paused', document.hidden)
    }

    sync()
    onVisibility()
    reduce.addEventListener('change', sync)
    fine.addEventListener('change', sync)
    hover.addEventListener('change', sync)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      reduce.removeEventListener('change', sync)
      fine.removeEventListener('change', sync)
      hover.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', onVisibility)
      document.documentElement.classList.remove('ambient-paused')
    }
  }, [isAdmin, isProducts])

  useEffect(() => {
    if (!cursorOn) return
    const el = glowRef.current
    if (!el) return

    const onMove = (e: PointerEvent) => {
      pos.current.tx = e.clientX
      pos.current.ty = e.clientY
    }

    const tick = () => {
      if (document.hidden) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      const p = pos.current
      p.x += (p.tx - p.x) * 0.16
      p.y += (p.ty - p.y) * 0.16
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf.current)
    }
  }, [cursorOn])

  if (isAdmin || isProducts || !motionOk) return null

  return (
    <>
      <div className="ambient-atmosphere" aria-hidden>
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
        <div className="ambient-orb ambient-orb-c" />
        <div className="ambient-particles">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="ambient-particle"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      </div>
      {cursorOn ? <div ref={glowRef} className="cursor-glow" aria-hidden /> : null}
    </>
  )
}
