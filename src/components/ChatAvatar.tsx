'use client'

import Image from 'next/image'
import { useState } from 'react'
import { GUEST_AVATAR_SRC } from '@/lib/profile-avatars'

type Props = {
  src: string
  alt: string
  size?: number
  className?: string
  fallbackSrc?: string
  /** Hibás képnél ne guest fallback, hanem semmi (pl. profilválasztó). */
  hideOnError?: boolean
  onLoadError?: () => void
}

/** Kör alakú chat / profil avatar. SVG és a Gulumen logo unoptimized. */
export function ChatAvatar({
  src,
  alt,
  size = 32,
  className = '',
  fallbackSrc,
  hideOnError = false,
  onLoadError,
}: Props) {
  const [broken, setBroken] = useState(false)
  const resolved = broken || !src ? fallbackSrc || GUEST_AVATAR_SRC : src
  if (hideOnError && (broken || !src?.trim())) return null
  const isLocal = resolved.startsWith('/')
  const unoptimized =
    resolved.endsWith('.svg') || resolved.includes('/img/logo') || resolved.includes('logo-round')

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--card-bg)] ${className}`}
      style={{ width: size, height: size }}
    >
      {isLocal ? (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized={unoptimized}
          onError={() => {
            setBroken(true)
            onLoadError?.()
          }}
        />
      ) : (
        <img
          src={resolved}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
            setBroken(true)
            onLoadError?.()
          }}
        />
      )}
    </span>
  )
}
