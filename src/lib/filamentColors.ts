/**
 * Filament színek a 3D nyomtatott termékekhez.
 * Bővíthető további színekkel.
 */
export type FilamentColor = {
  id: string
  name: string
  nameEn?: string
  nameDe?: string
  nameRo?: string
  hex: string
}

export const FILAMENT_COLORS: FilamentColor[] = [
  { id: 'white', name: 'Fehér', nameEn: 'White', nameDe: 'Weiß', nameRo: 'Alb', hex: '#FFFFFF' },
  { id: 'black', name: 'Fekete', nameEn: 'Black', nameDe: 'Schwarz', nameRo: 'Negru', hex: '#1a1a1a' },
  { id: 'red', name: 'Piros', nameEn: 'Red', nameDe: 'Rot', nameRo: 'Roșu', hex: '#c41e3a' },
  { id: 'blue', name: 'Kék', nameEn: 'Blue', nameDe: 'Blau', nameRo: 'Albastru', hex: '#2563eb' },
  { id: 'green', name: 'Zöld', nameEn: 'Green', nameDe: 'Grün', nameRo: 'Verde', hex: '#16a34a' },
  { id: 'grey', name: 'Szürke', nameEn: 'Grey', nameDe: 'Grau', nameRo: 'Gri', hex: '#6b7280' },
  { id: 'yellow', name: 'Sárga', nameEn: 'Yellow', nameDe: 'Gelb', nameRo: 'Galben', hex: '#eab308' },
  { id: 'gold', name: 'Arany', nameEn: 'Gold', nameDe: 'Gold', nameRo: 'Auriu', hex: '#d4af37' },
  { id: 'brown', name: 'Barna', nameEn: 'Brown', nameDe: 'Braun', nameRo: 'Maro', hex: '#8b4513' },
  { id: 'wood', name: 'Fámintázat', nameEn: 'Wood', nameDe: 'Holzoptik', nameRo: 'Nuanță lemn', hex: '#c4a574' },
  { id: 'stone', name: 'Kőmintázat', nameEn: 'Stone', nameDe: 'Steinoptik', nameRo: 'Nuanță piatră', hex: '#9e9e9e' },
  { id: 'neon-pink', name: 'Neon rózsaszín', nameEn: 'Neon pink', nameDe: 'Neonrosa', nameRo: 'Roz neon', hex: '#ff6ec7' },
  { id: 'neon-green', name: 'Neon zöld', nameEn: 'Neon green', nameDe: 'Neongrün', nameRo: 'Verde neon', hex: '#39ff14' },
  { id: 'neon-blue', name: 'Neon kék', nameEn: 'Neon blue', nameDe: 'Neonblau', nameRo: 'Albastru neon', hex: '#00d4ff' },
  { id: 'neon-yellow', name: 'Neon sárga', nameEn: 'Neon yellow', nameDe: 'Neongelb', nameRo: 'Galben neon', hex: '#ccff00' },
  { id: 'neon-orange', name: 'Neon narancs', nameEn: 'Neon orange', nameDe: 'Neonorange', nameRo: 'Portocaliu neon', hex: '#ff6600' },
]

export function getFilamentColorById(id: string): FilamentColor | undefined {
  return FILAMENT_COLORS.find((c) => c.id === id)
}

export function getFilamentColorName(color: FilamentColor, locale: string): string {
  switch (locale) {
    case 'hu':
      return color.name
    case 'en':
      return color.nameEn ?? color.name
    case 'de':
      return color.nameDe ?? color.nameEn ?? color.name
    case 'ro':
      return color.nameRo ?? color.nameEn ?? color.name
    default:
      return color.nameEn ?? color.name
  }
}
