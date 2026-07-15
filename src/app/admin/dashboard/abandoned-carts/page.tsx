import { AbandonedCartsSection } from './AbandonedCartsSection'

export default function AdminAbandonedCartsPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Elhagyott kosarak</h1>
        <p className="text-sm text-muted mt-1">
          Bejelentkezett vásárlók kosara. Ha 7 napja nem vásároltak, személyes kedvezményt
          küldhetsz (10–25%) a kosár tartalmára – e-mailben és egy egyszer használható kuponnal.
        </p>
      </div>
      <AbandonedCartsSection />
    </div>
  )
}
