'use client'

import { useState } from 'react'
import type { Product } from '@/lib/data'

const tabs = [
  { id: 'leiras', label: 'Leírás' },
  { id: 'szallitas', label: 'Szállítás' },
  { id: 'visszakuldes', label: 'Visszaküldés' },
] as const

export function ProductTabs({ product }: { product: Product }) {
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('leiras')

  return (
    <div>
      <div className="flex border-b border-[var(--border)] gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`py-2 px-1 border-b-2 -mb-px font-medium text-sm transition-colors ${
              active === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4 text-muted text-sm">
        {active === 'leiras' && <p>{product.description}</p>}
        {active === 'szallitas' && (
          <ul className="list-disc pl-5 space-y-1">
            <li>Posta, GLS, Foxpost, DPD</li>
            <li>Ingyenes szállítás 25 000 Ft felett</li>
            <li>Feladás: fizetés után 24–48 órán belül</li>
            <li>Személyes átvétel nem lehetséges</li>
          </ul>
        )}
        {active === 'visszakuldes' && (
          <ul className="list-disc pl-5 space-y-1">
            <li>Visszaküldési költséget a vásárló fizeti</li>
            <li>Visszatérítés 3 napon belül, a termék visszaérkezése és ellenőrzése után</li>
            <li>Nem fogadunk vissza: sérült, viselt, hiányzó alkatrészes, címke nélküli termékeket</li>
            <li>EU visszaküldési jog, kivéve: fehérnemű / higiéniai termékek</li>
          </ul>
        )}
      </div>
    </div>
  )
}
