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
  /**
   * Thumbnail / kis kép: Next.js image optimization (ne a teljes MB-os fájlt töltse).
   * CDN URL-eknél is engedélyezi az optimalizálást.
   */
  optimize?: boolean
}

function isRemoteCdnUrl(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.includes('b-cdn.net') ||
    url.includes('bunnycdn.com')
  )
}

function shouldUseNativeImg(url: string, optimize?: boolean): boolean {
  if (optimize) return false
  if (!url || url === PLACEHOLDER_IMAGE) return false
  // Külső / dinamikus CDN URL → natív <img> (Next Image optimalizálás nélkül)
  if (isRemoteCdnUrl(url)) return true
  if (url.startsWith('/uploads/')) return true
  return false
}

function shouldUnoptimize(url: string, optimize?: boolean): boolean {
  if (optimize) return false
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
  optimize,
}: Props) {
  const resolved = resolveImageUrl(src)
  const [failed, setFailed] = useState(false)
  const displaySrc = failed ? PLACEHOLDER_IMAGE : resolved
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'
  const useNative =
    !optimize && (preferNative || shouldUseNativeImg(displaySrc, optimize) || failed)

  if (useNative) {
    const nativeLoading = priority ? 'eager' : 'lazy'
    const nativeFetchPriority = priority ? 'high' : 'auto'
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt}
          width={width ?? 800}
          height={height ?? 800}
          className={`absolute inset-0 w-full h-full max-w-full ${fitClass} ${className}`}
          referrerPolicy="no-referrer"
          loading={nativeLoading}
          fetchPriority={nativeFetchPriority}
          decoding={priority ? 'sync' : 'async'}
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
        loading={nativeLoading}
        fetchPriority={nativeFetchPriority}
        decoding={priority ? 'sync' : 'async'}
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
        loading={priority ? undefined : 'lazy'}
        unoptimized={shouldUnoptimize(displaySrc, optimize)}
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
      loading={priority ? undefined : 'lazy'}
      unoptimized={shouldUnoptimize(displaySrc, optimize)}
      onError={() => {
        if (!failed) setFailed(true)
      }}
    />
  )
}
