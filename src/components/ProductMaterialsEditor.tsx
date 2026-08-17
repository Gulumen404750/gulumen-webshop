'use client'

import {
  FILAMENT_MATERIALS,
  normalizeMaterials,
  type FilamentMaterial,
} from '@/lib/filamentMaterials'

type Props = {
  value: string[] | null | undefined
  onChange: (materials: FilamentMaterial[]) => void
  required?: boolean
}

export function ProductMaterialsEditor({ value, onChange, required }: Props) {
  const selected = normalizeMaterials(value)
  const remaining = FILAMENT_MATERIALS.filter((m) => !selected.includes(m))

  const replaceAt = (index: number, next: FilamentMaterial) => {
    const copy = [...selected]
    copy[index] = next
    onChange(normalizeMaterials(copy))
  }

  const removeAt = (index: number) => {
    onChange(selected.filter((_, i) => i !== index))
  }

  const addMaterial = (material: FilamentMaterial) => {
    onChange(normalizeMaterials([...selected, material]))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-1">
        Anyag{required ? ' *' : ''}
      </label>
      <p className="text-xs text-muted">
        Csak a listából választható (PLA, PETG, TPU), elgépelés nélkül. A vásárló ezek közül
        választ; a kiválasztott érték a gyártási JSON-ba kerül.
      </p>
      {selected.length === 0 ? (
        <select
          required={required}
          value=""
          onChange={(e) => {
            const next = e.target.value as FilamentMaterial
            if (next) addMaterial(next)
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
      ) : (
        <div className="space-y-2">
          {selected.map((material, index) => (
            <div key={`${material}-${index}`} className="flex gap-2">
              <select
                required={required && index === 0}
                value={material}
                onChange={(e) => replaceAt(index, e.target.value as FilamentMaterial)}
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              >
                {FILAMENT_MATERIALS.map((m) => (
                  <option key={m} value={m} disabled={m !== material && selected.includes(m)}>
                    {m}
                  </option>
                ))}
              </select>
              {(selected.length > 1 || !required) && (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--border)]/40"
                >
                  Törlés
                </button>
              )}
            </div>
          ))}
          {remaining.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const next = e.target.value as FilamentMaterial
                if (next) addMaterial(next)
              }}
              className="w-full rounded-lg border border-dashed border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">További anyag hozzáadása…</option>
              {remaining.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
