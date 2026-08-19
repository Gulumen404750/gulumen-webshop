/**
 * URL-safe termék slug segédek.
 * Next.js App Router gyakran percent-encoded formában adja a [slug] paramot;
 * az admin pedig ékezetes szöveget is beírhat – mindkettőt kezeljük.
 */

const CHAR_MAP: Record<string, string> = {
  á: 'a',
  à: 'a',
  ä: 'a',
  â: 'a',
  ã: 'a',
  ă: 'a',
  é: 'e',
  è: 'e',
  ë: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  ï: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ö: 'o',
  ô: 'o',
  õ: 'o',
  ő: 'o',
  ú: 'u',
  ù: 'u',
  ü: 'u',
  û: 'u',
  ű: 'u',
  ç: 'c',
  ñ: 'n',
  ș: 's',
  ş: 's',
  ț: 't',
  ţ: 't',
}

/** Percent-encoding feloldása (max 2 kör a dupla encode ellen). */
export function decodeProductSlug(slug: string): string {
  let current = slug
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) break
      current = decoded
    } catch {
      break
    }
  }
  return current
}

/** Ékezetek és diakritikus jelek eltávolítása (lámpa ↔ lampa). */
export function foldAccents(value: string): string {
  const lower = value.toLowerCase()
  let folded = ''
  for (const ch of lower) {
    folded += CHAR_MAP[ch] ?? ch
  }
  return folded.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Magyar/ékezetes szöveg → ASCII kebab-case slug. */
export function slugifyProduct(input: string): string {
  const slug = foldAccents(input.trim())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'termek'
}

/** DB kereséshez: nyers + dekódolt változatok. */
export function productSlugLookupCandidates(slug: string): string[] {
  const decoded = decodeProductSlug(slug)
  return [...new Set([slug, decoded].filter((s) => s.length > 0))]
}
