'use client'

import { useEffect, useState } from 'react'
import {
  FILAMENT_COLORS,
  ensureExactlyOneBase,
  getBaseColorVariant,
  normalizeColorVariants,
  normalizeHexColor,
  serializeColorVariants,
  setBaseColorVariant,
  type ColorVariant,
} from '@/lib/filamentColors'
import { CdnImageManager } from '@/components/CdnImageManager'
import { cleanCdnUrls } from '@/lib/cdn'

/** Feltöltési cél: egyszínű alaptermék, vagy egy konkrét színvariáció. */
export type ImageUploadTarget = 'none' | string

type Props = {
  value: ColorVariant[] | Record<string, string[]> | null | undefined
  productImages: string[]
  onChange: (next: {
    colorImages: ColorVariant[]
    productImages: string[]
    image: string
  }) => void
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

function deriveProductGallery(colorImages: ColorVariant[], fallback: string[]): string[] {
  const variants = normalizeColorVariants(colorImages)
  if (variants.length === 0) return cleanCdnUrls(fallback)
  const base = getBaseColorVariant(variants)
  const fromBase = base?.images?.length ? cleanCdnUrls(base.images) : []
  if (fromBase.length) return fromBase
  const firstWithImages = variants.find((v) => v.images.length > 0)
  if (firstWithImages) return cleanCdnUrls(firstWithImages.images)
  return cleanCdnUrls(fallback)
}

export function ProductColorImagesEditor({ value, productImages, onChange }: Props) {
  const variants = normalizeColorVariants(value)
  const hasColorVariants = variants.length > 0

  const [target, setTarget] = useState<ImageUploadTarget>(() =>
    hasColorVariants ? (getBaseColorVariant(variants)?.id ?? variants[0]?.id ?? 'none') : 'none'
  )
  const [newColorId, setNewColorId] = useState('')

  useEffect(() => {
    if (target === 'none') return
    if (!variants.some((v) => v.id === target)) {
      setTarget(hasColorVariants ? (getBaseColorVariant(variants)?.id ?? variants[0].id) : 'none')
    }
  }, [target, variants, hasColorVariants])

  const emit = (colorImages: ColorVariant[], images: string[]) => {
    const cleanedImages = cleanCdnUrls(images)
    onChange({
      colorImages: serializeColorVariants(colorImages),
      productImages: cleanedImages,
      image: cleanedImages[0] || '',
    })
  }

  const selectNone = () => {
    setTarget('none')
    // Egyszínű mód: színvariációk törlése, a jelenlegi termékfotók megmaradnak.
    const images =
      productImages.length > 0
        ? productImages
        : deriveProductGallery(variants, [])
    emit([], images)
  }

  const selectColor = (colorId: string) => {
    setTarget(colorId)
  }

  const commitVariants = (next: ColorVariant[]) => {
    const normalized = ensureExactlyOneBase(next)
    const gallery = deriveProductGallery(normalized, productImages)
    emit(normalized, gallery)
  }

  const activeVariant =
    target !== 'none' ? variants.find((v) => v.id === target) ?? null : null

  const addPaletteVariant = () => {
    if (!newColorId) return
    addFilamentVariant(newColorId)
    setNewColorId('')
  }

  const addFilamentVariant = (filamentId: string) => {
    const filament = FILAMENT_COLORS.find((c) => c.id === filamentId)
    if (!filament) return
    const existingIdx = variants.findIndex((v) => v.id === filament.id)
    if (existingIdx >= 0) {
      setTarget(filament.id)
      return
    }
    const migrateImages =
      variants.length === 0 && productImages.length > 0 ? cleanCdnUrls(productImages) : []
    const next: ColorVariant[] = [
      ...variants,
      {
        id: filament.id,
        name: filament.name,
        nameEn: filament.nameEn,
        nameDe: filament.nameDe,
        nameRo: filament.nameRo,
        hex: normalizeHexColor(filament.hex),
        images: migrateImages,
        isBase: variants.length === 0,
      },
    ]
    commitVariants(next)
    setTarget(filament.id)
  }

  const removeVariant = (colorId: string) => {
    const next = variants.filter((v) => v.id !== colorId)
    if (next.length === 0) {
      const images =
        activeVariant?.images?.length
          ? cleanCdnUrls(activeVariant.images)
          : productImages
      setTarget('none')
      emit([], images)
      return
    }
    commitVariants(next)
    if (target === colorId) {
      setTarget(getBaseColorVariant(next)?.id ?? next[0].id)
    }
  }

  const updateActive = (patch: Partial<ColorVariant>) => {
    if (!activeVariant) return
    const next = variants.map((v) => (v.id === activeVariant.id ? { ...v, ...patch } : v))
    commitVariants(next)
  }

  const setActiveImages = (images: string[]) => {
    updateActive({ images: cleanCdnUrls(images) })
  }

  const setNoneImages = (images: string[]) => {
    emit([], cleanCdnUrls(images))
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Termékfotók és színkezelés
        </label>
        <p className="text-xs text-muted">
          Feltöltés előtt válaszd ki a célt: egyszínű alaptermék (nincs színválasztó a shopban),
          vagy egy konkrét színvariáció, amelyhez a képek tartoznak.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          Feltöltés célja
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectNone}
            className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
              target === 'none'
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-[var(--border)] bg-background text-foreground hover:border-accent/50'
            }`}
          >
            Nincs szín / Egyszínű (Csak alaptermék)
          </button>
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectColor(v.id)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                target === v.id
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
              {v.isBase && (
                <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">
                  Alap
                </span>
              )}
              {v.images.length > 0 && (
                <span className="text-xs text-muted tabular-nums">{v.images.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-3">
        <p className="text-xs font-medium text-muted">Új szín hozzáadása (paletta)</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted self-center mr-1">Gyors:</span>
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
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Szín a palettából *</label>
            <select
              value={newColorId}
              onChange={(e) => {
                setNewColorId(e.target.value)
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
            >
              <option value="">Válassz színt…</option>
              {FILAMENT_COLORS.filter((c) => !variants.some((v) => v.id === c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addPaletteVariant}
            disabled={!newColorId}
            className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm font-medium hover:bg-[var(--border)]/20 disabled:opacity-50"
          >
            + Szín hozzáadása
          </button>
        </div>
      </div>

      {target === 'none' ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-medium text-foreground">
            Alaptermék képei (nincs színvariáció)
          </p>
          <p className="text-xs text-muted">
            A feltöltött képek közvetlenül a termékhez tartoznak. A vásárlói oldalon nem jelenik meg
            színválasztó.
          </p>
          <CdnImageManager
            label="Termékfotók"
            multiple
            values={productImages}
            onChangeMultiple={setNoneImages}
            showGuide
          />
        </div>
      ) : activeVariant ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-[var(--border)]"
                style={{ backgroundColor: activeVariant.hex }}
                aria-hidden
              />
              {activeVariant.name || activeVariant.hex} – képek
            </p>
            <div className="flex flex-wrap gap-2">
              {!activeVariant.isBase && (
                <button
                  type="button"
                  onClick={() => commitVariants(setBaseColorVariant(variants, activeVariant.id))}
                  className="text-xs font-medium text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent/10"
                >
                  Beállítás alaptermékként
                </button>
              )}
              <button
                type="button"
                onClick={() => removeVariant(activeVariant.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Szín törlése
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Szín a palettából *</label>
              <select
                value={
                  FILAMENT_COLORS.some((c) => c.id === activeVariant.id)
                    ? activeVariant.id
                    : FILAMENT_COLORS.find((c) => c.name === activeVariant.name)?.id || ''
                }
                onChange={(e) => {
                  const filament = FILAMENT_COLORS.find((c) => c.id === e.target.value)
                  if (!filament) return
                  if (variants.some((v) => v.id === filament.id && v.id !== activeVariant.id)) return
                  const nextId = ensureUniqueId(filament.id, variants, variants.findIndex((v) => v.id === activeVariant.id))
                  updateActive({
                    id: nextId,
                    name: filament.name,
                    nameEn: filament.nameEn,
                    nameDe: filament.nameDe,
                    nameRo: filament.nameRo,
                    hex: normalizeHexColor(filament.hex),
                  })
                  setTarget(nextId)
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm"
              >
                {!FILAMENT_COLORS.some((c) => c.id === activeVariant.id || c.name === activeVariant.name) && (
                  <option value="">{activeVariant.name || 'Egyedi szín'}</option>
                )}
                {FILAMENT_COLORS.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={variants.some((v) => v.id === c.id && v.id !== activeVariant.id)}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">HEX színkód</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={normalizeHexColor(activeVariant.hex)}
                  onChange={(e) => updateActive({ hex: normalizeHexColor(e.target.value) })}
                  className="h-10 w-12 rounded border border-[var(--border)] bg-background cursor-pointer"
                  aria-label="Színválasztó"
                />
                <input
                  value={activeVariant.hex}
                  onChange={(e) => updateActive({ hex: e.target.value })}
                  onBlur={(e) =>
                    updateActive({ hex: normalizeHexColor(e.target.value, activeVariant.hex) })
                  }
                  placeholder="#1a1a1a"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <CdnImageManager
            label={`Képek: ${activeVariant.name || activeVariant.hex}`}
            multiple
            values={activeVariant.images}
            onChangeMultiple={setActiveImages}
            showGuide
          />
          <p className="text-xs text-muted">
            Ezek a képek a kiválasztott színvariációhoz tartoznak. Mentéskor a termék fő fotója az
            alaptermék / első feltöltött szín galériájából jön.
          </p>
        </div>
      ) : null}
    </div>
  )
}
