'use client'

import { useState } from 'react'
import {
  FILAMENT_COLORS,
  normalizeColorVariants,
  normalizeHexColor,
  serializeColorVariants,
  slugifyColorId,
  type ColorVariant,
} from '@/lib/filamentColors'
import { CdnImageManager } from '@/components/CdnImageManager'
import { cleanCdnUrls } from '@/lib/cdn'

type Props = {
  value: ColorVariant[] | Record<string, string[]> | null | undefined
  onChange: (next: ColorVariant[]) => void
}

function ensureUniqueId(base: string, existing: ColorVariant[], excludeIndex?: number): string {
  let id = base || `color-${Date.now().toString(36)}`
  let n = 2
  while (existing.some((v, i) => i !== excludeIndex && v.id === id)) {
    id = `${base}-${n}`
    n += 1
  }
  return id
}

export function ProductColorImagesEditor({ value, onChange }: Props) {
  const variants = normalizeColorVariants(value)
  const [activeIndex, setActiveIndex] = useState(0)
  const safeIndex = variants.length === 0 ? 0 : Math.min(activeIndex, variants.length - 1)
  const active = variants[safeIndex] ?? null

  const commit = (next: ColorVariant[]) => {
    onChange(serializeColorVariants(next))
  }

  const updateActive = (patch: Partial<ColorVariant>) => {
    if (!active) return
    const next = [...variants]
    next[safeIndex] = { ...active, ...patch }
    commit(next)
  }

  const addCustomVariant = () => {
    const id = ensureUniqueId(slugifyColorId(`szin-${variants.length + 1}`), variants)
    const next: ColorVariant[] = [
      ...variants,
      { id, name: '', hex: '#888888', images: [] },
    ]
    commit(next)
    setActiveIndex(next.length - 1)
  }

  const addFilamentVariant = (filamentId: string) => {
    const filament = FILAMENT_COLORS.find((c) => c.id === filamentId)
    if (!filament) return
    const existingIdx = variants.findIndex((v) => v.id === filament.id)
    if (existingIdx >= 0) {
      setActiveIndex(existingIdx)
      return
    }
    const next: ColorVariant[] = [
      ...variants,
      {
        id: filament.id,
        name: filament.name,
        nameEn: filament.nameEn,
        nameDe: filament.nameDe,
        nameRo: filament.nameRo,
        hex: normalizeHexColor(filament.hex),
        images: [],
      },
    ]
    commit(next)
    setActiveIndex(next.length - 1)
  }

  const removeVariant = (index: number) => {
    const next = variants.filter((_, i) => i !== index)
    commit(next)
    setActiveIndex((i) => Math.max(0, Math.min(i, next.length - 1)))
  }

  const setActiveImages = (images: string[]) => {
    updateActive({ images: cleanCdnUrls(images) })
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Színvariációk és színhez kötött képek
        </label>
        <p className="text-xs text-muted">
          Adj hozzá színeket névvel vagy HEX kóddal, majd tölts fel hozzájuk képeket.
          A termékoldalon a vásárló színválasztáskor az adott szín galériáját látja.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {variants.map((v, i) => {
          const isActive = i === safeIndex
          return (
            <button
              key={`${v.id}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-[var(--border)] bg-background text-foreground hover:border-accent/50'
              }`}
              title={v.name || v.hex}
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-[var(--border)] shadow-inner"
                style={{ backgroundColor: v.hex }}
                aria-hidden
              />
              <span>{v.name || v.hex}</span>
              {v.images.length > 0 && (
                <span className="text-xs text-muted tabular-nums">{v.images.length}</span>
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={addCustomVariant}
          className="rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-muted hover:bg-[var(--border)]/20"
        >
          + Színvariáció
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted self-center mr-1">Gyors hozzáadás:</span>
        {FILAMENT_COLORS.map((c) => {
          const added = variants.some((v) => v.id === c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => addFilamentVariant(c.id)}
              disabled={added}
              className="w-6 h-6 rounded-full border border-[var(--border)] disabled:opacity-40 hover:ring-2 hover:ring-accent/40"
              style={{ backgroundColor: c.hex }}
              title={added ? `${c.name} (már hozzáadva)` : c.name}
              aria-label={c.name}
            />
          )
        })}
      </div>

      {active ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Szín neve</label>
              <input
                value={active.name}
                onChange={(e) => {
                  const name = e.target.value
                  const nextId = ensureUniqueId(
                    slugifyColorId(name || active.hex, active.hex),
                    variants,
                    safeIndex
                  )
                  updateActive({ name, id: active.name ? active.id : nextId })
                }}
                placeholder="pl. Fekete, Fehér, Piros"
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">HEX színkód</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={normalizeHexColor(active.hex)}
                  onChange={(e) => updateActive({ hex: normalizeHexColor(e.target.value) })}
                  className="h-10 w-12 rounded border border-[var(--border)] bg-background cursor-pointer"
                  aria-label="Színválasztó"
                />
                <input
                  value={active.hex}
                  onChange={(e) => updateActive({ hex: e.target.value })}
                  onBlur={(e) => updateActive({ hex: normalizeHexColor(e.target.value, active.hex) })}
                  placeholder="#1a1a1a"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-[var(--border)]"
                style={{ backgroundColor: active.hex }}
                aria-hidden
              />
              {active.name || active.hex} – képek
            </p>
            <button
              type="button"
              onClick={() => removeVariant(safeIndex)}
              className="text-xs text-red-600 hover:underline"
            >
              Színvariáció törlése
            </button>
          </div>

          <CdnImageManager
            label={`Képek: ${active.name || active.hex}`}
            multiple
            values={active.images}
            onChangeMultiple={setActiveImages}
            showGuide
          />
        </div>
      ) : (
        <p className="text-sm text-muted border-t border-[var(--border)] pt-3">
          Még nincs színvariáció. Kattints a „+ Színvariáció” gombra, vagy válassz a gyors színek közül.
        </p>
      )}
    </div>
  )
}
