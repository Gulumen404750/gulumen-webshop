'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { LOCALES, type Locale } from '@/i18n/locales'
import { categories, getCategoryName } from '@/lib/data'

const navItems: { href: string; labelKey: string }[] = [
  { href: '/ujdonsagok', labelKey: 'nav.new' },
  { href: '/akciok', labelKey: 'nav.deals' },
  { href: '/beszerzesre-rendelheto', labelKey: 'nav.sourcing' },
  { href: '/szallitas', labelKey: 'nav.shipping' },
  { href: '/visszakuldes', labelKey: 'nav.returns' },
  { href: '/kapcsolat', labelKey: 'nav.contact' },
]

export function Header() {
  const pathname = usePathname()
  const { t, locale, setLocale } = useLocale()
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('gulumen-dark')
    const prefers = typeof window !== 'undefined' && window.matchMedia('(prefers-dark-mode: dark)').matches
    setDark(stored === 'true' || (!stored && prefers))
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('gulumen-dark', 'true')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('gulumen-dark', 'false')
    }
  }, [dark, mounted])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false)
      if (productsRef.current && !productsRef.current.contains(target)) setProductsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex w-10 h-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--card-bg)] border border-[var(--border)]">
              <Image src="/img/logo.png" alt="Gulumen" width={40} height={40} className="object-cover w-full h-full" />
            </span>
            <span className="font-heading font-bold text-xl text-foreground">Gulumen</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <div className="relative" ref={productsRef}>
              <button
                type="button"
                onClick={() => setProductsOpen((o) => !o)}
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  pathname === '/termekek' ? 'text-accent' : 'text-foreground hover:text-accent'
                }`}
                aria-expanded={productsOpen}
                aria-haspopup="true"
                aria-label={t('nav.products')}
              >
                {t('nav.products')}
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {productsOpen && (
                <ul className="absolute left-0 top-full mt-1 py-2 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg z-50">
                  <li>
                    <Link
                      href="/termekek"
                      className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--border)] hover:text-accent"
                      onClick={() => setProductsOpen(false)}
                    >
                      {t('nav.allProducts')}
                    </Link>
                  </li>
                  {categories.map((cat) => (
                    <li key={cat.slug}>
                      <Link
                        href={`/termekek?kategoria=${cat.slug}`}
                        className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--border)] hover:text-accent"
                        onClick={() => setProductsOpen(false)}
                      >
                        {getCategoryName(cat, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {navItems.map(({ href, labelKey }) => {
              const isDeals = href === '/akciok'
              const link = (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === href ? 'text-accent' : 'text-foreground hover:text-accent'
                  } ${isDeals ? 'relative z-10' : ''}`}
                >
                  {t(labelKey)}
                </Link>
              )
              return isDeals ? (
                <span key={href} className="nav-link-fire">
                  {link}
                </span>
              ) : (
                link
              )
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--border)] border border-[var(--border)]"
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                aria-label={t('common.language')}
              >
                <span className="uppercase">{locale}</span>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {langOpen && (
                <ul
                  className="absolute right-0 top-full mt-1 py-2 w-48 max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg z-50"
                  role="listbox"
                >
                  {LOCALES.map((loc) => (
                    <li key={loc}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={loc === locale}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                          loc === locale ? 'bg-accent/15 text-accent' : 'text-foreground hover:bg-[var(--border)]'
                        }`}
                        onClick={() => {
                          setLocale(loc as Locale)
                          setLangOpen(false)
                        }}
                      >
                        {t(`common.lang_${loc}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('common.search')}
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            <Link
              href="/kosar"
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('common.cart')}
            >
              <CartIcon className="w-5 h-5" />
            </Link>
            <Link
              href="/profil"
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('common.profile')}
            >
              <ProfileIcon className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={dark ? t('common.lightMode') : t('common.darkMode')}
            >
              {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
