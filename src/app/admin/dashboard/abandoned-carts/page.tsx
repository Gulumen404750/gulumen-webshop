import { AbandonedCartsSection } from './AbandonedCartsSection'

export default function AdminAbandonedCartsPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Elhagyott kosarak</h1>
        <p className="text-sm text-muted mt-1">
          Bejelentkezett vásárlók meg nem vásárolt kosarai. Megnyitás után választhatsz
          kedvezményt (10 vagy 15%, kupon + e-mail), vagy küldhetsz alap emlékeztető e-mailt kupon
          nélkül a vásárló címére.
        </p>
      </div>
      <AbandonedCartsSection />
    </div>
  )
}
