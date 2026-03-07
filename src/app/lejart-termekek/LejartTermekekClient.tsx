'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/lib/data'

type Props = { products: Product[]; serverNow: number }

export function LejartTermekekClient({ products, serverNow }: Props) {
  const router = useRouter()

  useEffect(() => {
    router.refresh()
  }, [router])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/beszerzesre-rendelheto"
        className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-accent rounded"
      >
        <ArrowLeft className="shrink-0 size-5" aria-hidden />
        <span>Vissza a beszerzésre rendelhető termékekhez</span>
      </Link>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">Lejárt termékek</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            sourcingListMode
            serverNow={serverNow}
            expiredListMode
          />
        ))}
      </div>
      {products.length === 0 && (
        <p className="text-muted text-center py-12">Nincs lejárt ajánlat az elmúlt 5 napból.</p>
      )}
    </div>
  )
}
