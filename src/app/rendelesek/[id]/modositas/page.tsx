import { Suspense } from 'react'
import OrderShippingEditClient from './OrderShippingEditClient'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-12 text-muted">Betöltés…</div>
      }
    >
      <OrderShippingEditClient />
    </Suspense>
  )
}
