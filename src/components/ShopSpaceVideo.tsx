'use client'

import { useEffect, useRef } from 'react'

export const SHOP_SPACE_VIDEO_SRC = '/videos/futuristic-space-glowing-lines.mp4'

/**
 * Terméklista háttér: némított, loopolt űr-videó. Nincs hang.
 */
export function ShopSpaceVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      video.muted = true
      video.defaultMuted = true
      video.volume = 0
      if (reduce.matches) {
        video.pause()
        return
      }
      const play = video.play()
      if (play) void play.catch(() => {})
    }

    apply()
    reduce.addEventListener('change', apply)
    return () => reduce.removeEventListener('change', apply)
  }, [])

  return (
    <div className="shop-space-bg" aria-hidden>
      <video
        ref={videoRef}
        className="shop-space-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
      >
        <source src={SHOP_SPACE_VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="shop-space-scrim" />
    </div>
  )
}
