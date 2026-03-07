import Link from 'next/link'

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Kuponok / kedvezmények</h1>
      <p className="text-muted">
        A kupon kezelés UI hamarosan elérhető. Addig a kedvezmények a loyalty rendszeren és a checkout
        paramétereken keresztül működnek.
      </p>
      <p className="text-sm text-muted">
        A <code className="rounded bg-[var(--border)] px-1">Coupon</code> modell már létezik a Prisma sémában.
        Kupon CRUD API és űrlap következik.
      </p>
    </div>
  )
}
