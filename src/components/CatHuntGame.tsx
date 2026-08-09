'use client'

import { useCallback, useEffect, useRef } from 'react'
import styles from './CatHuntGame.module.css'
import { useLocale } from '@/context/LocaleContext'

export function CatHuntGame() {
  const { t } = useLocale()
  const cursorRef = useRef<HTMLDivElement>(null)
  const catRef = useRef<HTMLDivElement>(null)
  const successMessage = t('catHunt.catchSuccess')

  const moveCat = useCallback(() => {
    const cat = catRef.current
    if (!cat) return

    const maxX = window.innerWidth - 100
    const maxY = window.innerHeight - 100
    const randomX = Math.max(50, Math.floor(Math.random() * maxX))
    const randomY = Math.max(50, Math.floor(Math.random() * maxY))

    cat.style.left = `${randomX}px`
    cat.style.top = `${randomY}px`
  }, [])

  useEffect(() => {
    const cursor = cursorRef.current
    const cat = catRef.current
    if (!cursor || !cat) return

    const onMouseMove = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`
      cursor.style.top = `${e.clientY}px`

      const hoverElement = document.elementFromPoint(e.clientX, e.clientY)
      if (hoverElement === cat) {
        cursor.classList.add(styles.customCursorActive)
      } else {
        cursor.classList.remove(styles.customCursorActive)
      }
    }

    const onCatClick = () => {
      alert(successMessage)
    }

    document.addEventListener('mousemove', onMouseMove)
    cat.addEventListener('mouseover', moveCat)
    cat.addEventListener('click', onCatClick)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      cat.removeEventListener('mouseover', moveCat)
      cat.removeEventListener('click', onCatClick)
    }
  }, [moveCat, successMessage])

  return (
    <div className={styles.gameContainer}>
      <div ref={cursorRef} className={styles.customCursor} aria-hidden />
      <div ref={catRef} className={styles.catTarget} role="button" tabIndex={0} aria-label={t('catHunt.catAria')}>
        🐈
      </div>
    </div>
  )
}
