'use client'

import Link, { type LinkProps } from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { localizePath, shouldSkipLocaleRouting } from '@/i18n/routing'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  LinkProps & {
    children?: ReactNode
    /** Ha true, nem lokalizálja az href-et (pl. külső / admin). */
    skipLocale?: boolean
  }

function localizeHref(href: string, locale: Parameters<typeof localizePath>[1]): string {
  if (!href.startsWith('/')) return href
  const hashIndex = href.indexOf('#')
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const [path, query] = withoutHash.split('?')
  if (shouldSkipLocaleRouting(path)) return href
  return localizePath(path, locale, query ? `?${query}` : '') + hash
}

/**
 * Next Link wrapper: belső útvonalakat az aktuális locale szerinti URL-re fordítja.
 * Pl. href="/termekek" + en → "/en/products"
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, Props>(function LocaleLink(
  { href, skipLocale, ...rest },
  ref
) {
  const { locale } = useLocale()

  let nextHref = href
  if (!skipLocale && typeof href === 'string') {
    nextHref = localizeHref(href, locale)
  }

  return <Link ref={ref} href={nextHref} {...rest} />
})
