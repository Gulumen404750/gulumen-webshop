'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLocale } from '@/context/LocaleContext'

const MOUSE_COUNT = 28
const EFFECT_DURATION_MS = 4000

export function HeroCat() {
  const { t } = useLocale()
  const { isLoggedIn } = useAuth()
  const { status, activate } = useCatCoupon()
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const [zigzagStopped, setZigzagStopped] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [activatedJustNow, setActivatedJustNow] = useState(false)

  const handleCatClick = useCallback(() => {
    if (triggered) return
    setTriggered(true)
    setZigzagStopped(true)
    setActivatedJustNow(false)
    setShowModal(true)
    setTimeout(() => {
      setZigzagStopped(false)
      setTriggered(false)
    }, EFFECT_DURATION_MS)
  }, [triggered])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setActivatedJustNow(false)
  }, [])

  const handleActivateCoupon = useCallback(() => {
    const ok = activate()
    if (ok) setActivatedJustNow(true)
  }, [activate])

  const mousePositions = useMemo(
    () =>
      Array.from({ length: MOUSE_COUNT }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
      })),
    [triggered]
  )

  const showImage = imageLoaded && !imageError

  return (
    <>
      {/* 5% kupon modal – mindig kattintásra */}
      {showModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-coupon-modal-title"
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl p-6 text-center">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 p-2 rounded-full text-muted hover:text-foreground hover:bg-[var(--border)] transition-colors"
              aria-label={t('buttons.close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 id="cat-coupon-modal-title" className="font-heading text-xl font-bold text-foreground mt-2 mb-3">
              {t('coupon.title')}
            </h2>

            {activatedJustNow ? (
              <>
                <p className="text-foreground mb-4">{t('coupon.activated')}</p>
                <Link
                  href="/kosar"
                  className="inline-block w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('buttons.goToCart')}
                </Link>
              </>
            ) : !isLoggedIn ? (
              <>
                <p className="text-foreground mb-4">{t('coupon.loggedInRequired')}</p>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/profil"
                    className="inline-block w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {t('buttons.login')}
                  </Link>
                  <Link
                    href="/regisztracio"
                    className="inline-block w-full py-3 px-4 border-2 border-accent text-accent font-heading font-semibold rounded-lg hover:bg-accent/10 transition-colors"
                  >
                    {t('buttons.register')}
                  </Link>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-muted hover:text-foreground font-medium"
                  >
                    {t('buttons.cancel')}
                  </button>
                </div>
              </>
            ) : status === 'not_claimed' ? (
              <>
                <p className="text-foreground mb-4">{t('coupon.activateHint')}</p>
                <button
                  type="button"
                  onClick={handleActivateCoupon}
                  className="w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('buttons.activateCoupon')}
                </button>
              </>
            ) : (
              <>
                <p className="text-foreground mb-4">{t('coupon.alreadyActivated')}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full py-3 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {t('buttons.ok')}
                  </button>
                  <Link
                    href="/kosar"
                    className="inline-block w-full py-3 px-4 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
                  >
                    {t('buttons.openCart')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Egér eső – minden elkapáskor */}
      {triggered && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none block" aria-hidden>
          {mousePositions.map((pos, i) => (
            <span
              key={i}
              className="absolute mouse-rain-item text-2xl sm:text-3xl opacity-90"
              style={{
                left: `${pos.left}%`,
                top: '-30px',
                animationDelay: `${pos.delay}s`,
              }}
            >
              🐭
            </span>
          ))}
        </div>
      )}

      {/* Macska */}
      <div
        className={`
          absolute w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36
          min-w-[5rem] min-h-[5rem]
          ${zigzagStopped ? 'hero-cat-stopped' : 'hero-cat-zigzag'}
          select-none block
          cursor-pointer
          transition-[left,top,transform] duration-500
          hover:scale-110 active:scale-95
          z-[5]
        `}
        onClick={handleCatClick}
        onKeyDown={(e) => e.key === 'Enter' && handleCatClick()}
        role="button"
        tabIndex={0}
        aria-label="Macska – kattints az egér esőért"
      >
        <div className="relative w-full h-full">
          <span
            className={`text-5xl sm:text-7xl lg:text-8xl block w-full h-full flex items-center justify-center ${
              showImage ? 'invisible' : ''
            }`}
            aria-hidden
          >
            🐱
          </span>
          <img
            src="/img/nyam-cat.gif"
            alt=""
            className={`absolute inset-0 w-full h-full object-contain drop-shadow-lg pointer-events-none transition-opacity duration-300 ${
              showImage ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            draggable={false}
            loading="eager"
          />
          {triggered && (
            <>
              <span className="absolute top-[18%] left-[28%] text-base sm:text-xl lg:text-2xl opacity-95 pointer-events-none" aria-hidden>❤️</span>
              <span className="absolute top-[18%] left-[52%] text-base sm:text-xl lg:text-2xl opacity-95 pointer-events-none" aria-hidden>❤️</span>
            </>
          )}
        </div>
      </div>
    </>
  )
}
