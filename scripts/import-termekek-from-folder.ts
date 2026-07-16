/**
 * Tömeges termékimport a public/img/termekek mappából.
 *
 * Elvárt struktúra (ajánlott):
 *   public/img/termekek/<kategoria>/<termek-slug>/01.webp
 *   public/img/termekek/<kategoria>/<termek-slug>/02.webp
 *
 * Egyszerűbb (egy kép / termék):
 *   public/img/termekek/<kategoria>/<termek-slug>.webp
 *
 * Kategória slugok (webshop):
 *   taskak, ruhazat, kiegeszitok, elektronika, otthon,
 *   3d-nyomtatott, 3d-konyha, 3d-jatek, 3d-kert, 3d-lakasdekor,
 *   3d-eszkozok, 3d-kreativ, 3d-ajandek
 *
 * Futtatás (projekt gyökér, DATABASE_URL beállítva):
 *   npx tsx scripts/import-termekek-from-folder.ts
 *   npx tsx scripts/import-termekek-from-folder.ts --dry-run
 *   npx tsx scripts/import-termekek-from-folder.ts --price=3990 --stock=10
 *
 * Opcionális CSV felülírás (ár, név): public/img/termekek/products.csv
 *   slug,name,priceHuf,stock,category
 *   noveny-kotozo,Növény kötöző,2490,20,3d-kert
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const ROOT = path.join(process.cwd(), 'public', 'img', 'termekek')
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

const CATEGORY_ALIASES: Record<string, string> = {
  '3d': '3d-nyomtatott',
  '3d-nyomtatott-termekek': '3d-nyomtatott',
  bags: 'taskak',
  clothing: 'ruhazat',
  accessories: 'kiegeszitok',
  electronics: 'elektronika',
  home: 'otthon',
  kert: '3d-kert',
  konyha: '3d-konyha',
  jatek: '3d-jatek',
  lakasdekor: '3d-lakasdekor',
  eszkozok: '3d-eszkozok',
  kreativ: '3d-kreativ',
  ajandek: '3d-ajandek',
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
  image: string
  images: string[]
  is3d: boolean
}

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  let priceHuf = 3990
  let stock = 10
  for (const a of args) {
    if (a.startsWith('--price=')) priceHuf = Number(a.split('=')[1]) || priceHuf
    if (a.startsWith('--stock=')) stock = Number(a.split('=')[1]) || stock
  }
  return { dryRun, priceHuf, stock }
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

function resolveCategory(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  if (VALID_CATEGORIES.has(key)) return key
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key]
  return null
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXT.has(path.extname(filename).toLowerCase())
}

function publicUrl(...parts: string[]): string {
  return '/' + ['img', 'termekek', ...parts].map((p) => p.replace(/^\/+|\/+$/g, '')).join('/')
}

function loadCsvOverrides(): Map<string, CsvRow> {
  const map = new Map<string, CsvRow>()
  const csvPath = path.join(ROOT, 'products.csv')
  if (!fs.existsSync(csvPath)) return map
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
  return map
}

function discoverProducts(): DiscoveredProduct[] {
  if (!fs.existsSync(ROOT)) {
    throw new Error(`Nincs ilyen mappa: ${ROOT}`)
  }

  const products: DiscoveredProduct[] = []
  const categoryDirs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())

  for (const catDir of categoryDirs) {
    const category = resolveCategory(catDir.name)
    if (!category) {
      console.warn(`⚠ Ismeretlen kategória mappa, kihagyva: ${catDir.name}`)
      continue
    }

    const catPath = path.join(ROOT, catDir.name)
    const entries = fs.readdirSync(catPath, { withFileTypes: true })

    // alkönyvtár = termék
    for (const entry of entries.filter((e) => e.isDirectory())) {
      const productPath = path.join(catPath, entry.name)
      const images = fs
        .readdirSync(productPath)
        .filter(isImageFile)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((f) => publicUrl(catDir.name, entry.name, f))
      if (images.length === 0) {
        console.warn(`⚠ Nincs kép, kihagyva: ${catDir.name}/${entry.name}`)
        continue
      }
      const slug = slugify(entry.name)
      products.push({
        slug,
        category,
        name: titleFromSlug(slug),
        image: images[0],
        images,
        is3d: category.startsWith('3d-'),
      })
    }

    // laza fájlok a kategória gyökerében = 1 kép / termék
    for (const file of entries.filter((e) => e.isFile() && isImageFile(e.name))) {
      const base = path.parse(file.name).name
      const slug = slugify(base)
      const image = publicUrl(catDir.name, file.name)
      products.push({
        slug,
        category,
        name: titleFromSlug(slug),
        image,
        images: [image],
        is3d: category.startsWith('3d-'),
      })
    }
  }

  // dedupe slug
  const bySlug = new Map<string, DiscoveredProduct>()
  for (const p of products) {
    const existing = bySlug.get(p.slug)
    if (existing) {
      existing.images = Array.from(new Set([...existing.images, ...p.images]))
      if (!existing.image) existing.image = p.image
    } else {
      bySlug.set(p.slug, p)
    }
  }
  return Array.from(bySlug.values())
}

function hufToEur(huf: number): number {
  return Math.max(1, Math.round(huf / 390))
}

async function main() {
  const { dryRun, priceHuf: defaultPrice, stock: defaultStock } = parseArgs()
  const overrides = loadCsvOverrides()
  const discovered = discoverProducts()

  if (discovered.length === 0) {
    console.error(
      'Nem találtam terméket.\n' +
        'Rakd a képeket ide:\n' +
        '  public/img/termekek/<kategoria>/<termek-slug>/01.webp\n' +
        'pl. public/img/termekek/3d-kert/noveny-kotozo/01.webp'
    )
    process.exit(1)
  }

  console.log(`Talált termékek: ${discovered.length}${dryRun ? ' (dry-run)' : ''}`)

  const prisma = new PrismaClient()
  let created = 0
  let updated = 0

  try {
    for (const p of discovered) {
      const ov = overrides.get(p.slug)
      const category = ov?.category && resolveCategory(ov.category) ? resolveCategory(ov.category)! : p.category
      const name = ov?.name?.trim() || p.name
      const priceHuf = ov?.priceHuf && ov.priceHuf > 0 ? ov.priceHuf : defaultPrice
      const stock = ov?.stock != null && ov.stock >= 0 ? ov.stock : defaultStock
      const priceEur = hufToEur(priceHuf)
      const is3d = category.startsWith('3d-')

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
        image: p.image,
        images: p.images,
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

      console.log(`→ ${p.slug} | ${category} | ${priceHuf} Ft | ${p.images.length} kép`)

      if (dryRun) continue

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
    await prisma.$disconnect()
  }

  console.log(
    dryRun
      ? `Dry-run kész. Importáláshoz: npx tsx scripts/import-termekek-from-folder.ts`
      : `Kész. Új: ${created}, frissített: ${updated}.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
