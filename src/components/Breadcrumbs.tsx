import { LocaleLink as Link } from '@/components/LocaleLink'
import { categories } from '@/lib/data'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

type BreadcrumbItem = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href && { item: item.href.startsWith('http') ? item.href : `${BASE_URL}${item.href}` }),
    })),
  }

  return (
    <>
      <nav aria-label="Morzsamenü" className="flex flex-wrap items-center gap-1 text-sm text-muted mb-6">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-muted/70">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-accent transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  )
}

export function productBreadcrumbs(categorySlug: string | undefined, productName: string): BreadcrumbItem[] {
  const base: BreadcrumbItem[] = [{ label: 'Termékek', href: '/termekek' }]
  if (categorySlug) {
    const cat = categories.find((c) => c.slug === categorySlug)
    base.push({ label: cat?.name ?? categorySlug, href: `/termekek?kategoria=${categorySlug}` })
  }
  base.push({ label: productName })
  return base
}
