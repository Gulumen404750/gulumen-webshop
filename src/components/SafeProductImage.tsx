'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PLACEHOLDER_IMAGE, resolveImageUrl } from '@/lib/cdn'

type Props = {
  src: string | null | undefined
  alt: string
  /** object-fit: cover (kártyák) vagy contain (galéria). */
  fit?: 'cover' | 'contain'
  className?: string
  /** next/image fill mód (szülő relative). */
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  /** Ha true, mindig natív <img> (külső CDN / uploads). */
  preferNative?: boolean
}

function isRemoteCdnUrl(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.includes('b-cdn.net') ||
    url.includes('bunnycdn.com')
  )
}

function shouldUseNativeImg(url: string): boolean {
  if (!url || url === PLACEHOLDER_IMAGE) return false
  // Külső / dinamikus CDN URL → natív <img> (Next Image optimalizálás nélkül)
  if (isRemoteCdnUrl(url)) return true
  if (url.startsWith('/uploads/')) return true
  return false
}

function shouldUnoptimize(url: string): boolean {
  return (
    url.startsWith('/uploads/') ||
    url === PLACEHOLDER_IMAGE ||
    isRemoteCdnUrl(url)
  )
}

/**
 * Termékkép megjelenítő: cleanCdnUrl + hiba esetén placeholder (nincs törött ikon).
 */
export function SafeProductImage({
  src,
  alt,
  fit = 'cover',
  className = '',
  fill = true,
  width,
  height,
  sizes,
  priority,
  preferNative,
}: Props) {
  const resolved = resolveImageUrl(src)
  const [failed, setFailed] = useState(false)
  const displaySrc = failed ? PLACEHOLDER_IMAGE : resolved
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'
  const useNative = preferNative || shouldUseNativeImg(displaySrc) || failed

  if (useNative) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt}
          className={`absolute inset-0 w-full h-full ${fitClass} ${className}`}
          referrerPolicy="no-referrer"
          onError={() => {
            if (!failed) setFailed(true)
          }}
        />
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={displaySrc}
        alt={alt}
        width={width}
        height={height}
        className={`${fitClass} ${className}`}
        referrerPolicy="no-referrer"
        onError={() => {
          if (!failed) setFailed(true)
        }}
      />
    )
  }

  if (fill) {
    return (
      <Image
        src={displaySrc}
        alt={alt}
        fill
        className={`${fitClass} ${className}`}
        sizes={sizes}
        priority={priority}
        unoptimized={shouldUnoptimize(displaySrc)}
        onError={() => {
          if (!failed) setFailed(true)
        }}
      />
    )
  }

  return (
    <Image
      src={displaySrc}
      alt={alt}
      width={width ?? 800}
      height={height ?? 800}
      className={`${fitClass} ${className}`}
      sizes={sizes}
      priority={priority}
      unoptimized={shouldUnoptimize(displaySrc)}
      onError={() => {
        if (!failed) setFailed(true)
      }}
    />
  )
}
