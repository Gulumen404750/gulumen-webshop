/**
 * Tömeges termékimport kategorizált termékfotó-mappából.
 *
 * Elvárt struktúra:
 *   <forrás>/<kategoria>/<termek-slug>/01.webp
 *   <forrás>/<kategoria>/<termek-slug>/02.webp
 *
 * vagy:
 *   <forrás>/<kategoria>/<termek-slug>.webp
 *
 * Alap forrás: public/img/termekek
 * Külső mappa (pl. Windows „Veboldalhoz termékek google igazítással”):
 *   npx tsx scripts/import-termekek-from-folder.ts --source="C:/Users/.../Veboldalhoz termékek google igazítással/termekek" --copy
 *
 * --copy: a képeket bemásolja public/img/termekek alá (kell az éles megjelenéshez)
 * --dry-run: csak listáz, nem ír DB-t
 * --price=3990 --stock=10: alapértelmezett ár / készlet
 *
 * Opcionális CSV: <forrás>/products.csv vagy public/img/termekek/products.csv
 *   slug,name,priceHuf,stock,category
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const DEFAULT_ROOT = path.join(process.cwd(), 'public', 'img', 'termekek')
const PUBLIC_TARGET = DEFAULT_ROOT
const IMAGE_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif'])

const VALID_CATEGORIES = new Set([
  'taskak',
  'ruhazat',
  'kiegeszitok',
  'elektronika',
  'otthon',
  '3d-nyomtatott',
  '3d-konyha',
  '3d-jatek',
  '3d-kert',
  '3d-lakasdekor',
  '3d-eszkozok',
  '3d-kreativ',
  '3d-ajandek',
])

/** Mappanevek → webshop kategória slug */
const CATEGORY_ALIASES: Record<string, string> = {
  '3d': '3d-nyomtatott',
  '3d-nyomtatott-termekek': '3d-nyomtatott',
  '3d nyomtatott': '3d-nyomtatott',
  '3d nyomtatott termekek': '3d-nyomtatott',
  bags: 'taskak',
  clothing: 'ruhazat',
  accessories: 'kiegeszitok',
  electronics: 'elektronika',
  home: 'otthon',
  kert: '3d-kert',
  konyha: '3d-konyha',
  jatek: '3d-jatek',
  játék: '3d-jatek',
  lakasdekor: '3d-lakasdekor',
  'lakásdekor': '3d-lakasdekor',
  eszkozok: '3d-eszkozok',
  'eszközök': '3d-eszkozok',
  kreativ: '3d-kreativ',
  'kreatív': '3d-kreativ',
  ajandek: '3d-ajandek',
  'ajándék': '3d-ajandek',
  taskak: 'taskak',
  'táskák': 'taskak',
  ruhazat: 'ruhazat',
  'ruházat': 'ruhazat',
  kiegeszitok: 'kiegeszitok',
  'kiegészítők': 'kiegeszitok',
  elektronika: 'elektronika',
  otthon: 'otthon',
  kategorizalt: '', // skip – dig deeper
  'kategorizált': '',
  'kategorizalt termekek': '',
  'kategorizált termékek': '',
  termekek: '',
  'termékek': '',
}

type CsvRow = {
  slug: string
  name?: string
  priceHuf?: number
  stock?: number
  category?: string
}

type DiscoveredProduct = {
  slug: string
  category: string
  name: string
  /** Abszolút fájlutak a forrás képekre (másoláshoz) */
  sourceFiles: string[]
  /** Web URL path (/img/termekek/...) */
  image: string
  images: string[]
  is3d: boolean
}

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const copy = args.includes('--copy')
  let priceHuf = 3990
  let stock = 10
  let source = DEFAULT_ROOT
  for (const a of args) {
    if (a.startsWith('--price=')) priceHuf = Number(a.split('=')[1]) || priceHuf
    if (a.startsWith('--stock=')) stock = Number(a.split('=')[1]) || stock
    if (a.startsWith('--source=')) source = a.slice('--source='.length).replace(/^["']|["']$/g, '')
  }
  return { dryRun, copy, priceHuf, stock, source: path.resolve(source) }
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function resolveCategory(raw: string): string | null {
  const key = normalizeKey(raw)
  const dashed = key.replace(/\s+/g, '-')
  if (VALID_CATEGORIES.has(dashed)) return dashed
  if (VALID_CATEGORIES.has(key)) return key
  if (CATEGORY_ALIASES[key] !== undefined) {
    const mapped = CATEGORY_ALIASES[key]
    return mapped || null // empty string = container folder
  }
  if (CATEGORY_ALIASES[dashed] !== undefined) {
    const mapped = CATEGORY_ALIASES[dashed]
    return mapped || null
  }
  return null
}

function isContainerFolder(name: string): boolean {
  const key = normalizeKey(name)
  const dashed = key.replace(/\s+/g, '-')
  return (
    CATEGORY_ALIASES[key] === '' ||
    CATEGORY_ALIASES[dashed] === '' ||
    key === 'termekek' ||
    key === 'kategorizalt' ||
    key.startsWith('kategorizalt')
  )
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXT.has(path.extname(filename).toLowerCase())
}

function publicUrl(...parts: string[]): string {
  return '/' + ['img', 'termekek', ...parts].map((p) => p.replace(/^\/+|\/+$/g, '')).join('/')
}

function loadCsvOverrides(sourceRoot: string): Map<string, CsvRow> {
  const map = new Map<string, CsvRow>()
  const candidates = [path.join(sourceRoot, 'products.csv'), path.join(DEFAULT_ROOT, 'products.csv')]
  const csvPath = candidates.find((p) => fs.existsSync(p))
  if (!csvPath) return map
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return map
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map((c) => c.trim())
    const row: Record<string, string> = {}
    header.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    if (!row.slug) continue
    map.set(row.slug, {
      slug: row.slug,
      name: row.name || undefined,
      priceHuf: row.pricehuf ? Number(row.pricehuf) : undefined,
      stock: row.stock ? Number(row.stock) : undefined,
      category: row.category || undefined,
    })
  }
  console.log(`CSV betöltve: ${csvPath} (${map.size} sor)`)
  return map
}

/** Megkeresi a tényleges kategória-gyökeret (ha van „termekek” / „kategorizált” köztes mappa). */
function findCatalogRoot(source: string): string {
  if (!fs.existsSync(source)) {
    throw new Error(`Nincs ilyen forrás mappa: ${source}`)
  }

  const direct = fs.readdirSync(source, { withFileTypes: true }).filter((d) => d.isDirectory())
  const hasCategory = direct.some((d) => resolveCategory(d.name) && !isContainerFolder(d.name))
  if (hasCategory) return source

  // pl. .../Veboldalhoz.../termekek  vagy  .../kategorizált termékek
  for (const d of direct) {
    if (isContainerFolder(d.name) || normalizeKey(d.name).includes('termek')) {
      const nested = path.join(source, d.name)
      const nestedDirs = fs.readdirSync(nested, { withFileTypes: true }).filter((x) => x.isDirectory())
      if (nestedDirs.some((x) => resolveCategory(x.name) || isContainerFolder(x.name))) {
        return findCatalogRoot(nested)
      }
    }
  }

  // ha a source maga „termekek”, és alatta kategóriák vannak alias nélkül is – próbáljuk
  return source
}

function discoverInCategory(catPath: string, categorySlug: string): DiscoveredProduct[] {
  const products: DiscoveredProduct[] = []
  const entries = fs.readdirSync(catPath, { withFileTypes: true })

  for (const entry of entries.filter((e) => e.isDirectory())) {
    const productPath = path.join(catPath, entry.name)
    const files = fs
      .readdirSync(productPath)
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (files.length === 0) {
      console.warn(`⚠ Nincs kép, kihagyva: ${categorySlug}/${entry.name}`)
      continue
    }
    const slug = slugify(entry.name)
    const absFiles = files.map((f) => path.join(productPath, f))
    const images = files.map((f) => publicUrl(categorySlug, slug, f))
    products.push({
      slug,
      category: categorySlug,
      name: titleFromSlug(slug),
      sourceFiles: absFiles,
      image: images[0],
      images,
      is3d: categorySlug.startsWith('3d-'),
    })
  }

  for (const file of entries.filter((e) => e.isFile() && isImageFile(e.name))) {
    const base = path.parse(file.name).name
    const slug = slugify(base)
    const abs = path.join(catPath, file.name)
    const destFile = `${slug}${path.extname(file.name).toLowerCase()}`
    const image = publicUrl(categorySlug, destFile)
    products.push({
      slug,
      category: categorySlug,
      name: titleFromSlug(slug),
      sourceFiles: [abs],
      image,
      images: [image],
      is3d: categorySlug.startsWith('3d-'),
    })
  }

  return products
}

function discoverProducts(catalogRoot: string): DiscoveredProduct[] {
  const products: DiscoveredProduct[] = []
  const categoryDirs = fs
    .readdirSync(catalogRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())

  for (const catDir of categoryDirs) {
    if (isContainerFolder(catDir.name)) {
      // mélyebb szint
      const nestedRoot = path.join(catalogRoot, catDir.name)
      products.push(...discoverProducts(nestedRoot))
      continue
    }

    const category = resolveCategory(catDir.name)
    if (!category) {
      console.warn(`⚠ Ismeretlen kategória mappa, kihagyva: ${catDir.name}`)
      console.warn(`   Engedélyezett pl.: 3d-kert, 3d-konyha, taskak, otthon, ...`)
      continue
    }

    const catPath = path.join(catalogRoot, catDir.name)
    products.push(...discoverInCategory(catPath, category))
  }

  const bySlug = new Map<string, DiscoveredProduct>()
  for (const p of products) {
    const existing = bySlug.get(p.slug)
    if (existing) {
      existing.images = Array.from(new Set([...existing.images, ...p.images]))
      existing.sourceFiles = Array.from(new Set([...existing.sourceFiles, ...p.sourceFiles]))
      if (!existing.image) existing.image = p.image
    } else {
      bySlug.set(p.slug, p)
    }
  }
  return Array.from(bySlug.values())
}

function copyProductImages(product: DiscoveredProduct): { image: string; images: string[] } {
  const destDir = path.join(PUBLIC_TARGET, product.category, product.slug)
  fs.mkdirSync(destDir, { recursive: true })
  const copiedUrls: string[] = []

  product.sourceFiles.forEach((src, index) => {
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return
    const ext = path.extname(src).toLowerCase()
    const base = path.basename(src)
    // ha a forrás egyetlen laza fájl volt category gyökérben, egységes 01.ext
    const destName =
      product.sourceFiles.length === 1 && !base.match(/^\d+/)
        ? `${String(index + 1).padStart(2, '0')}${ext}`
        : base
    const dest = path.join(destDir, destName)
    fs.copyFileSync(src, dest)
    copiedUrls.push(publicUrl(product.category, product.slug, destName))
  })

  if (copiedUrls.length === 0) {
    return { image: product.image, images: product.images }
  }
  return { image: copiedUrls[0], images: copiedUrls }
}

function hufToEur(huf: number): number {
  return Math.max(1, Math.round(huf / 390))
}

async function main() {
  const { dryRun, copy, priceHuf: defaultPrice, stock: defaultStock, source } = parseArgs()
  const catalogRoot = findCatalogRoot(source)
  console.log(`Forrás: ${source}`)
  console.log(`Katalógus gyökér: ${catalogRoot}`)

  const overrides = loadCsvOverrides(catalogRoot)
  const discovered = discoverProducts(catalogRoot)

  if (discovered.length === 0) {
    console.error(
      'Nem találtam terméket.\n' +
        'Kell ilyen struktúra:\n' +
        '  <mappa>/<kategoria>/<termek-nev>/01.webp\n' +
        'pl. .../termekek/3d-kert/noveny-kotozo/01.webp\n\n' +
        'Windows példa:\n' +
        '  npx tsx scripts/import-termekek-from-folder.ts --source="C:\\\\Users\\\\...\\\\Veboldalhoz termékek google igazítással" --copy --dry-run'
    )
    process.exit(1)
  }

  console.log(`Talált termékek: ${discovered.length}${dryRun ? ' (dry-run)' : ''}${copy ? ' (+másolás public/img/termekek-be)' : ''}`)

  const prisma = dryRun ? null : new PrismaClient()
  let created = 0
  let updated = 0

  try {
    for (const p of discovered) {
      const ov = overrides.get(p.slug)
      const category =
        ov?.category && resolveCategory(ov.category) ? resolveCategory(ov.category)! : p.category
      const name = ov?.name?.trim() || p.name
      const priceHuf = ov?.priceHuf && ov.priceHuf > 0 ? ov.priceHuf : defaultPrice
      const stock = ov?.stock != null && ov.stock >= 0 ? ov.stock : defaultStock
      const priceEur = hufToEur(priceHuf)
      const is3d = category.startsWith('3d-')

      let image = p.image
      let images = p.images
      if (copy && !dryRun) {
        const copied = copyProductImages({ ...p, category })
        image = copied.image
        images = copied.images
      } else if (copy && dryRun) {
        image = publicUrl(category, p.slug, path.basename(p.sourceFiles[0] || '01.webp'))
        images = p.sourceFiles.map((f) => publicUrl(category, p.slug, path.basename(f)))
      }

      console.log(`→ ${p.slug} | ${category} | ${priceHuf} Ft | ${images.length} kép`)

      if (dryRun || !prisma) continue

      const data = {
        slug: p.slug,
        name,
        nameEn: name,
        nameDe: name,
        nameRo: name,
        description_hu: is3d
          ? `Prémium 3D nyomtatott ${name} – közvetlenül a magyar gyártótól, gondos kivitelezéssel.`
          : `${name} – Gulumen kínálat.`,
        description_en: is3d
          ? `Premium 3D printed ${name} – directly from the Hungarian manufacturer.`
          : `${name} – Gulumen.`,
        description_de: is3d
          ? `Premium 3D-gedrucktes ${name} – direkt vom ungarischen Hersteller.`
          : `${name} – Gulumen.`,
        description_ro: is3d
          ? `${name} premium printat 3D – direct de la producătorul maghiar.`
          : `${name} – Gulumen.`,
        condition: 'Új',
        category,
        image,
        images,
        images360: [] as string[],
        priceHuf,
        priceEur,
        stock,
        isNew: true,
        onSale: false,
        active: true,
        isColorable: is3d,
        type: 'stock',
        sourcingEnabled: false,
      }

      const existing = await prisma.product.findUnique({ where: { slug: p.slug } })
      if (existing) {
        await prisma.product.update({
          where: { slug: p.slug },
          data: {
            name: data.name,
            category: data.category,
            image: data.image,
            images: data.images,
            priceHuf: data.priceHuf,
            priceEur: data.priceEur,
            stock: data.stock,
            isColorable: data.isColorable,
            active: true,
          },
        })
        updated++
      } else {
        await prisma.product.create({ data })
        created++
      }
    }
  } finally {
    if (prisma) await prisma.$disconnect()
  }

  console.log(
    dryRun
      ? `Dry-run kész. Éles import:\n  npx tsx scripts/import-termekek-from-folder.ts --source="${source}" --copy`
      : `Kész. Új: ${created}, frissített: ${updated}.`
  )
  if (copy && !dryRun) {
    console.log(`Képek másolva ide: ${PUBLIC_TARGET}`)
    console.log('Éles szerverre: commit + push + deploy (vagy töltsd fel a public/img/termekek tartalmát).')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
