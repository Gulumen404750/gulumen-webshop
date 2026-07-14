/**
 * Termékek seedelése az adatbázisba (production bootstrap).
 * Futtatás: npm run seed:products
 * A start.js deploy után is meghívja (upsert + régi teszt termékek archiválása).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

const now = new Date()

const stockProducts = [
  {
    id: '7',
    slug: 'rolltop-hatizsak-fekete-1',
    name: 'Roll-top hátizsák – fekete',
    nameEn: 'Roll-top backpack – black',
    nameDe: 'Roll-top Rucksack – schwarz',
    nameRo: 'Rucsac roll-top – negru',
    description_hu: 'Minimalista roll-top hátizsák, vízálló anyag, elöl cipzáras zseb.',
    description_en: 'Minimalist roll-top backpack, waterproof material, front zip pocket.',
    description_de: 'Minimalistischer Roll-Top-Rucksack, wasserdichtes Material, vordere Reißverschlusstasche.',
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-fekete-1.png',
    images: ['/img/rolltop-fekete-1.png'],
    images360: [] as string[],
    priceHuf: 11990,
    priceEur: 31,
    stock: 1,
    variants: [{ size: 'One size', color: 'Fekete' }],
    isNew: true,
    onSale: false,
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: false,
    modelUrl: null as string | null,
    active: true,
    archived: false,
  },
  {
    id: '3d-1',
    slug: 'noveny-kotozo',
    name: 'Növény kötöző',
    nameEn: 'Plant support strap',
    nameDe: 'Pflanzenstütze',
    nameRo: 'Suport plante',
    description_hu: '3D nyomtatott növénykötöző (PLA), strap 80 mm. Ellenőrzött, saját tervezés.',
    description_en: '3D printed plant support strap (PLA), 80 mm strap. Checked, own design.',
    description_de: '3D-gedruckter Pflanzenstützen-Gurt (PLA), 80 mm Gurt. Geprüft, eigenes Design.',
    condition: 'Új',
    category: '3d-kert',
    image: '/img/3d-noveny-kotozo.png',
    images: ['/img/3d-noveny-kotozo.png'],
    images360: [] as string[],
    modelUrl: '/models/noveny-kotozo.glb',
    priceHuf: 2490,
    priceEur: 6,
    stock: 10,
    variants: null,
    isNew: true,
    onSale: false,
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: true,
    active: true,
    archived: false,
  },
  {
    id: '3d-2',
    slug: 'szalveta-tarto-korok',
    name: 'Szalvéta tartó – körök',
    nameEn: 'Napkin holder – rings',
    nameDe: 'Serviettenhalter – Ringe',
    nameRo: 'Suport șervețele – inele',
    description_hu: '3D nyomtatott szalvétatartó, fa stílusú körök (PLA). Ellenőrzött, saját tervezés.',
    description_en: '3D printed napkin holder, wood-style rings (PLA). Checked, own design.',
    description_de: '3D-gedruckter Serviettenhalter, holzartige Ringe (PLA). Geprüft, eigenes Design.',
    condition: 'Új',
    category: '3d-konyha',
    image: '/img/3d-szalveta-tarto.png',
    images: ['/img/3d-szalveta-tarto.png'],
    images360: [] as string[],
    modelUrl: '/models/szalveta-tarto-korok.glb',
    priceHuf: 1890,
    priceEur: 5,
    stock: 10,
    variants: null,
    isNew: true,
    onSale: false,
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: true,
    active: true,
    archived: false,
  },
  {
    id: '3d-3',
    slug: 'kabel-rendezo-klipsz',
    name: 'Kábel rendező klipsz',
    nameEn: 'Cable organizer clip',
    nameDe: 'Kabel-Organizer-Klammer',
    nameRo: 'Cleme organizator cabluri',
    description_hu: '3D nyomtatott kábelrendező klipsz (PLA). Asztal szélére vagy falra rögzíthető.',
    description_en: '3D printed cable organizer clip (PLA). Attaches to desk edge or wall.',
    description_de: '3D-gedruckte Kabel-Organizer-Klammer (PLA). Für Tischkante oder Wand.',
    condition: 'Új',
    category: '3d-eszkozok',
    image: '/img/3d-szalveta-tarto.png',
    images: ['/img/3d-szalveta-tarto.png'],
    images360: [] as string[],
    modelUrl: null as string | null,
    priceHuf: 1290,
    priceEur: 4,
    discountPriceHuf: 990,
    discountPriceEur: 3,
    stock: 10,
    variants: null,
    isNew: false,
    onSale: true,
    saleStartAt: addDays(now, -2),
    saleEndAt: addDays(now, 14),
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: true,
    active: true,
    archived: false,
  },
]

const sourcingDeals = [
  {
    id: 'sd-1',
    slug: 'beszerzes-premium-hatizsak',
    name: 'Limitált beszerzés – Premium hátizsák',
    nameEn: 'Limited sourcing – Premium backpack',
    nameDe: 'Limitierte Beschaffung – Premium-Rucksack',
    nameRo: 'Aprovizionare limitată – Rucsac premium',
    description_hu: 'Időzített beszerzéses ajánlat. Limitált darabszám, csak a vásárlási ablakban rendelhető.',
    description_en: 'Timed sourcing offer. Limited quantity, only orderable during the purchase window.',
    description_de: 'Zeitgesteuertes Beschaffungsangebot. Begrenzte Menge, nur während des Kauffensters bestellbar.',
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-fekete-1.png',
    images: ['/img/rolltop-fekete-1.png'],
    images360: [] as string[],
    priceHuf: 14990,
    priceEur: 38,
    stock: 0,
    variants: null,
    isNew: false,
    onSale: false,
    type: 'sourcing_deal' as const,
    sourcingEnabled: true,
    dealStartAt: addDays(now, 12),
    dealEndAt: addDays(now, 15),
    previewFrom: addDays(now, -2),
    maxOrders: 10,
    isColorable: false,
    modelUrl: null as string | null,
    active: true,
    archived: false,
  },
]

const CANONICAL_SLUGS = [...stockProducts, ...sourcingDeals].map((p) => p.slug)

type SeedProduct = (typeof stockProducts)[number] | (typeof sourcingDeals)[number]

function productPayload(p: SeedProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameEn: p.nameEn,
    nameDe: p.nameDe,
    nameRo: p.nameRo,
    description_hu: p.description_hu,
    description_en: 'description_en' in p ? p.description_en : undefined,
    description_de: 'description_de' in p ? p.description_de : undefined,
    description_ro: 'description_ro' in p ? p.description_ro : undefined,
    condition: p.condition,
    category: p.category,
    image: p.image,
    images: p.images,
    images360: p.images360,
    modelUrl: p.modelUrl,
    priceHuf: p.priceHuf,
    priceEur: p.priceEur,
    discountPriceHuf: 'discountPriceHuf' in p ? p.discountPriceHuf : undefined,
    discountPriceEur: 'discountPriceEur' in p ? p.discountPriceEur : undefined,
    stock: p.stock,
    variants: p.variants ?? undefined,
    isNew: p.isNew,
    onSale: p.onSale,
    saleStartAt: 'saleStartAt' in p ? p.saleStartAt : undefined,
    saleEndAt: 'saleEndAt' in p ? p.saleEndAt : undefined,
    type: p.type,
    sourcingEnabled: p.sourcingEnabled,
    dealStartAt: 'dealStartAt' in p ? p.dealStartAt : undefined,
    dealEndAt: 'dealEndAt' in p ? p.dealEndAt : undefined,
    previewFrom: 'previewFrom' in p ? p.previewFrom : undefined,
    maxOrders: 'maxOrders' in p ? p.maxOrders : undefined,
    isColorable: p.isColorable,
    active: p.active,
    archived: p.archived,
  }
}

export async function seedProducts(): Promise<void> {
  console.log('[seed] Upserting canonical storefront catalog...')
  for (const p of [...stockProducts, ...sourcingDeals]) {
    const data = productPayload(p)
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: data,
      update: data,
    })
    console.log('[seed]   upserted', p.slug)
  }

  const archived = await prisma.product.updateMany({
    where: {
      slug: { notIn: CANONICAL_SLUGS },
      archived: false,
    },
    data: { active: false, archived: true },
  })
  if (archived.count > 0) {
    console.log(`[seed] Archived ${archived.count} legacy/test product(s) not in catalog.`)
  }
  console.log('[seed] Done.')
}

async function main() {
  await seedProducts()
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
