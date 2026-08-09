'use client'

import Image from 'next/image'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useLocale } from '@/context/LocaleContext'

export function ContactScene() {
  const { t } = useLocale()
  const [monitorOn, setMonitorOn] = useState(true)
  const [mugInHands, setMugInHands] = useState(true)
  const [mugOnTable, setMugOnTable] = useState(false)
  const monitorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMonitorClick = useCallback(() => {
    if (!monitorOn) return
    setMonitorOn(false)
    if (monitorTimeoutRef.current) clearTimeout(monitorTimeoutRef.current)
    monitorTimeoutRef.current = setTimeout(() => {
      setMonitorOn(true)
      monitorTimeoutRef.current = null
    }, 2500)
  }, [monitorOn])

  const handleMugClick = useCallback(() => {
    if (!mugInHands) return
    setMugInHands(false)
    setMugOnTable(true)
    if (pickUpTimeoutRef.current) clearTimeout(pickUpTimeoutRef.current)
    pickUpTimeoutRef.current = setTimeout(() => {
      setMugOnTable(false)
      setMugInHands(true)
      pickUpTimeoutRef.current = null
    }, 3000)
  }, [mugInHands])

  useEffect(() => {
    return () => {
      if (monitorTimeoutRef.current) clearTimeout(monitorTimeoutRef.current)
      if (pickUpTimeoutRef.current) clearTimeout(pickUpTimeoutRef.current)
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {/* Háttérkép: robot a monitornál, kávé a kezében */}
      <Image
        src="/img/kapcsolat-ai-robot.png"
        alt=""
        fill
        className="object-cover object-center"
        sizes="100vw"
        priority
      />

      {/* Monitor: kikapcsolható, majd a robot visszakapcsolja */}
      <button
        type="button"
        onClick={handleMonitorClick}
        className="absolute left-[10%] top-[22%] w-[28%] h-[32%] z-10 focus:outline-none focus:ring-2 focus:ring-white/50 rounded cursor-pointer"
        aria-label={monitorOn ? t('contactScene.monitorOff') : t('contactScene.monitorOn')}
      />
      {!monitorOn && (
        <div
          className="absolute left-[10%] top-[22%] w-[28%] h-[32%] bg-black/95 z-[5] rounded-sm"
          aria-hidden
        />
      )}

      {/* Kávé a kezében: kattintásra kikölt, majd a robot felveszi az asztalról */}
      {mugInHands && (
        <button
          type="button"
          onClick={handleMugClick}
          className="absolute right-[18%] top-[48%] w-[8%] h-[12%] z-10 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full cursor-pointer"
          aria-label={t('contactScene.coffeeAria')}
        />
      )}

      {/* Kávé az asztalon (leesett), majd a robot felveszi */}
      {mugOnTable && (
        <div
          className="absolute left-[38%] top-[72%] w-[6%] aspect-[0.7] z-10 pointer-events-none"
          aria-hidden
        >
          <div className="w-full h-full flex flex-col items-center justify-end">
            <div className="w-[85%] aspect-square rounded-full border-2 border-white/80 bg-white/90 shadow-lg" />
            <div className="w-[70%] h-[25%] -mt-[5%] border-2 border-white/80 rounded-b-md bg-white/90" />
          </div>
        </div>
      )}
    </div>
  )
}
