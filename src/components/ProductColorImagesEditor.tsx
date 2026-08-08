'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ProductImageUploader } from '@/components/ProductImageUploader'
import {
  FILAMENT_COLORS,
  normalizeColorImages,
  type ColorImagesMap,
} from '@/lib/filamentColors'

type Props = {
  value: ColorImagesMap | null | undefined
  onChange: (next: ColorImagesMap) => void
}

export function ProductColorImagesEditor({ value, onChange }: Props) {
  const colorImages = normalizeColorImages(value)
  const [activeColorId, setActiveColorId] = useState(FILAMENT_COLORS[0]?.id ?? 'white')
  const activeColor = FILAMENT_COLORS.find((c) => c.id === activeColorId) ?? FILAMENT_COLORS[0]
  const activeImages = colorImages[activeColorId] ?? []

  const setColorUrls = (colorId: string, urls: string[]) => {
    const next = { ...colorImages }
    const cleaned = urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
    if (cleaned.length === 0) delete next[colorId]
    else next[colorId] = cleaned
    onChange(next)
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Színek és képek
        </label>
        <p className="text-xs text-muted">
          Válassz színt, majd tölts fel hozzá képeket. A shopban csak azok a színek jelennek meg,
          amelyekhez van legalább egy kép. Kattintáskor a vásárló az adott szín képeit látja.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Elérhető színek">
        {FILAMENT_COLORS.map((color) => {
          const count = colorImages[color.id]?.length ?? 0
          const isActive = color.id === activeColorId
          return (
            <button
              key={color.id}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => setActiveColorId(color.id)}
              className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-[var(--border)] bg-background text-foreground hover:border-accent/50'
              }`}
              title={`${color.name}${count ? ` (${count} kép)` : ''}`}
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-[var(--border)] shadow-inner"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <span>{color.name}</span>
              {count > 0 && (
                <span className="text-xs text-muted tabular-nums">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {activeColor && (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-[var(--border)]"
              style={{ backgroundColor: activeColor.hex }}
              aria-hidden
            />
            {activeColor.name} – képek
          </p>

          {activeImages.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeImages.map((url, i) => (
                <li
                  key={`${url}-${i}`}
                  className="relative rounded-lg border border-[var(--border)] overflow-hidden bg-background"
                >
                  <div className="relative aspect-square">
                    {url.startsWith('/') ? (
                      <Image
                        src={url}
                        alt={`${activeColor.name} ${i + 1}`}
                        fill
                        className="object-contain"
                        sizes="160px"
                        unoptimized={url.startsWith('/uploads/')}
                      />
                    ) : (
                      <img
                        src={url}
                        alt={`${activeColor.name} ${i + 1}`}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setColorUrls(
                        activeColorId,
                        activeImages.filter((_, j) => j !== i)
                      )
                    }
                    className="absolute top-1 right-1 rounded bg-red-600/90 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                  >
                    Törlés
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ProductImageUploader
            label={`+ Kép feltöltése: ${activeColor.name}`}
            value=""
            onChange={() => {}}
            showUrlInput={false}
            mode="add"
            onAddUrl={(url) => setColorUrls(activeColorId, [...activeImages, url])}
          />

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Vagy kép URL hozzáadása…"
              className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const input = e.currentTarget
                const url = input.value.trim()
                if (!url) return
                setColorUrls(activeColorId, [...activeImages, url])
                input.value = ''
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const wrap = (e.currentTarget.previousElementSibling as HTMLInputElement | null)
                const url = wrap?.value?.trim()
                if (!url || !wrap) return
                setColorUrls(activeColorId, [...activeImages, url])
                wrap.value = ''
              }}
              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-foreground hover:bg-[var(--border)]/20"
            >
              Hozzáad
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
