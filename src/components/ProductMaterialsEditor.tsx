'use client'

import {
  FILAMENT_MATERIALS,
  defaultMaterialForProduct,
  type FilamentMaterial,
} from '@/lib/filamentMaterials'

type Props = {
  value: string[] | null | undefined
  onChange: (materials: FilamentMaterial[]) => void
  required?: boolean
}

export function ProductMaterialsEditor({ value, onChange, required }: Props) {
  const selected = defaultMaterialForProduct(value) ?? ''

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-1" htmlFor="product-material-admin">
        Anyag{required ? ' *' : ''}
      </label>
      <p className="text-xs text-muted">
        Gyártási anyag (PLA, PETG vagy TPU). Csak az admin és a gyártási JSON látja; a webshop
        vásárlói oldalain nem jelenik meg, a vendég nem választhat.
      </p>
      <select
        id="product-material-admin"
        required={required}
        value={selected}
        onChange={(e) => {
          const next = e.target.value as FilamentMaterial | ''
          onChange(next ? [next] : [])
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
      >
        <option value="">{required ? 'Válassz anyagot…' : 'Nincs anyag (nem 3D)'}</option>
        {FILAMENT_MATERIALS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
