'use client'

import { useState } from 'react'
import Image from 'next/image'

const ROUND_LOGO_SRC = '/img/logo-round.png'
const FALLBACK_LOGO_SRC = '/img/logo.png'

/** Lejárt ajánlat: sötétítés + blur, kerek Gulumen logo (villanás → pulzálás → forgás + 3D → robbanás), majd a kártya 3D-ben eltűnik. */
export function SoldImpactOverlay({ className = '', label }: { className?: string; label?: string }) {
  const [logoSrc, setLogoSrc] = useState(ROUND_LOGO_SRC)

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 pointer-events-none ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 bg-black/55 sold-impact-backdrop" />
      {label && (
        <span className="relative z-10 text-sm font-semibold text-white/95 sold-impact-label tracking-wide">
          {label}
        </span>
      )}
      <div className="relative w-1/3 min-w-[88px] max-w-[160px] aspect-square sold-impact-logo-wrap">
        <div className="absolute inset-0 rounded-full overflow-hidden bg-white/10 p-1.5">
          <div className="relative w-full h-full rounded-full overflow-hidden bg-[var(--card-bg)]">
            <Image
              src={logoSrc}
              alt=""
              fill
              className="object-contain"
              sizes="(max-width: 768px) 88px, 160px"
              onError={() => setLogoSrc(FALLBACK_LOGO_SRC)}
            />
          </div>
        </div>
        {/* Robbanás fényrészecskék */}
        {[...Array(8)].map((_, i) => (
          <span key={i} className="sold-impact-particle" />
        ))}
      </div>
    </div>
  )
}
