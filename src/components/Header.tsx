'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Phone, Box } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { useCart } from '@/context/CartContext'
import { useWishlist } from '@/context/WishlistContext'
import { LOCALES, type Locale } from '@/i18n/locales'
import { getStorefrontCategories, getCategoryName, threeDSubcategories } from '@/lib/data'
import { SearchModal } from '@/components/SearchModal'
import { CartDrawer } from '@/components/CartDrawer'
import { CallUsModal } from '@/components/CallUsModal'

const navItems: { href: string; labelKey: string }[] = [
  { href: '/akciok', labelKey: 'nav.deals' },
]

const helpDropdownItems: { href: string; labelKey: string }[] = [
  { href: '/szallitas', labelKey: 'nav.shipping' },
  { href: '/visszakuldes', labelKey: 'nav.returns' },
  { href: '/gyik', labelKey: 'nav.faq' },
  { href: '/kapcsolat', labelKey: 'nav.contact' },
]

export function Header() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, locale, setLocale } = useLocale()
  const { itemCount } = useCart()
  const { count: wishlistCount } = useWishlist()
  const [dark, setDark] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const [callUsModalOpen, setCallUsModalOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)

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
      if (helpRef.current && !helpRef.current.contains(target)) setHelpOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const openModal = () => setCallUsModalOpen(true)
    window.addEventListener('openCallUsModal', openModal)
    return () => window.removeEventListener('openCallUsModal', openModal)
  }, [])

  return (
    <>
    <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    <CartDrawer isOpen={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    <CallUsModal isOpen={callUsModalOpen} onClose={() => setCallUsModalOpen(false)} />
    <header className="sticky top-0 z-50 bg-background border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex w-10 h-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--card-bg)] border border-[var(--border)]">
              <Image src="/img/logo.png" alt="Gulumen" width={40} height={40} className="object-cover w-full h-full" />
            </span>
            <span className="font-heading font-bold text-xl text-foreground">Gulumen</span>
          </Link>

          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? (t('buttons.close') || 'Menü bezárása') : (t('nav.menu') || 'Menü')}
          >
            {mobileNavOpen ? <CloseIcon className="w-6 h-6" /> : <HamburgerIcon className="w-6 h-6" />}
          </button>

          <nav className={`${mobileNavOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row absolute md:relative top-full left-0 right-0 md:top-0 bg-[var(--card-bg)] md:bg-transparent border-b md:border-b-0 border-[var(--border)] md:border-0 py-4 md:py-0 items-center gap-3 md:gap-4 md:flex-nowrap md:min-h-[2.5rem] shadow-lg md:shadow-none z-40`}>
            <div
              className="relative flex items-center h-full"
              ref={productsRef}
              onMouseEnter={() => { setHelpOpen(false); setProductsOpen(true) }}
              onMouseLeave={() => setProductsOpen(false)}
            >
              {(() => {
                const is3DProductsActive =
                  pathname === '/termekek' &&
                  (!searchParams.get('kategoria') || searchParams.get('kategoria') === '3d-nyomtatott')
                return (
                  <Link
                    href="/termekek?kategoria=3d-nyomtatott"
                    className={`text-sm font-medium leading-none transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 h-full ${
                      is3DProductsActive ? 'text-accent' : 'text-foreground hover:text-accent'
                    }`}
                    aria-expanded={productsOpen}
                    aria-haspopup="true"
                    onClick={() => { setProductsOpen(false); setMobileNavOpen(false) }}
                  >
                    {t('nav.products')}
                    <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Link>
                )
              })()}
              {productsOpen && (() => {
                const threeDCat = getStorefrontCategories().find((c) => c.slug === '3d-nyomtatott')
                const subParam = searchParams.get('sub') ?? ''
                const is3DNav =
                  pathname === '/termekek' &&
                  (!searchParams.get('kategoria') || searchParams.get('kategoria') === '3d-nyomtatott')
                const is3DParentActive = is3DNav && !subParam
                return (
                  <div className="absolute left-0 top-full pt-1 min-w-[240px] z-50">
                    <ul className="nav-dropdown-panel py-2 min-w-[240px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
                    {threeDCat && (
                      <li>
                        <Link
                          href="/termekek?kategoria=3d-nyomtatott"
                          className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
                            is3DParentActive
                              ? 'bg-[var(--border)] text-accent'
                              : 'text-foreground hover:bg-[var(--border)] hover:text-accent'
                          }`}
                          onClick={() => { setProductsOpen(false); setMobileNavOpen(false) }}
                        >
                          <Box className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                          {getCategoryName(threeDCat, locale)}
                        </Link>
                      </li>
                    )}
                    {threeDSubcategories.map((sub) => {
                      const isSubActive = is3DNav && subParam === sub.slug
                      return (
                        <li key={sub.slug}>
                          <Link
                            href={`/termekek?kategoria=3d-nyomtatott&sub=${sub.slug}`}
                            className={`flex items-center gap-2.5 pl-9 pr-4 py-2 text-sm font-medium transition-colors ${
                              isSubActive
                                ? 'bg-[var(--border)] text-accent font-semibold'
                                : 'text-muted hover:bg-[var(--border)] hover:text-foreground'
                            }`}
                            onClick={() => { setProductsOpen(false); setMobileNavOpen(false) }}
                          >
                            <span className="text-base leading-none shrink-0" aria-hidden>{sub.icon}</span>
                            {getCategoryName(sub, locale)}
                          </Link>
                        </li>
                      )
                    })}
                    </ul>
                  </div>
                )
              })()}
            </div>
            {navItems.map(({ href, labelKey }) => {
              const isDeals = href === '/akciok'
              return (
                <span key={href} className={isDeals ? 'nav-link-fire' : ''}>
                  <Link
                    href={href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`text-sm font-medium leading-none transition-colors whitespace-nowrap shrink-0 inline-flex items-center ${
                      pathname === href ? 'text-accent' : 'text-foreground hover:text-accent'
                    } ${isDeals ? 'relative z-10' : ''}`}
                  >
                    {t(labelKey)}
                  </Link>
                </span>
              )
            })}
            <div
              className="relative flex items-center h-full"
              ref={helpRef}
              onMouseEnter={() => { setProductsOpen(false); setHelpOpen(true) }}
              onMouseLeave={() => setHelpOpen(false)}
            >
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                className={`text-sm font-medium leading-none transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 h-full ${
                  helpDropdownItems.some(({ href }) => pathname === href) ? 'text-accent' : 'text-foreground hover:text-accent'
                }`}
                aria-expanded={helpOpen}
                aria-haspopup="true"
                aria-label={t('nav.help')}
              >
                {t('nav.help')}
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {helpOpen && (
                <div className="absolute left-0 top-full pt-1 min-w-[200px] z-50 md:left-0">
                  <ul className="nav-dropdown-panel py-2 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
                  {helpDropdownItems.map(({ href, labelKey }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--border)] hover:text-accent"
                        onClick={() => { setHelpOpen(false); setMobileNavOpen(false) }}
                      >
                        {t(labelKey)}
                      </Link>
                    </li>
                  ))}
                  <li className="border-t border-[var(--border)] mt-1 pt-1">
                    <a
                      href={`tel:${(process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+36301234567').replace(/\s/g, '')}`}
                      className="md:hidden flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--border)] hover:text-accent"
                      onClick={() => { setHelpOpen(false); setMobileNavOpen(false) }}
                    >
                      <Phone className="w-4 h-4" />
                      {t('callUs.title')}
                    </a>
                    <button
                      type="button"
                      className="hidden md:flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--border)] hover:text-accent"
                      onClick={() => { setHelpOpen(false); setCallUsModalOpen(true) }}
                    >
                      <Phone className="w-4 h-4" />
                      {t('callUs.title')}
                    </button>
                  </li>
                  </ul>
                </div>
              )}
            </div>
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
            <Link
              href="/kedvencek"
              className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('wishlist.title') || 'Kedvencek'}
            >
              <HeartIcon className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => { setSearchOpen(true); setMobileNavOpen(false) }}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('common.search')}
              aria-expanded={searchOpen}
            >
              <SearchIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => { setCartDrawerOpen(true); setMobileNavOpen(false) }}
              className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
              aria-label={t('common.cart')}
              aria-expanded={cartDrawerOpen}
            >
              <CartIcon className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-accent text-white text-xs font-bold">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
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
    </>
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

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}

