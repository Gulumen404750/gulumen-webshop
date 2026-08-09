/**
 * Termékek seedelése az adatbázisba – CSAK manuálisan, soha nem fut deploy/start során.
 *
 * Biztonság:
 * - Indításkor NEM fut (scripts/start.js nem hívja).
 * - Csak ALLOW_PRODUCT_SEED=1 mellett futtatható.
 * - Meglévő termékeket NEM írja felül (csak create, ha a slug hiányzik).
 *
 * Futtatás: ALLOW_PRODUCT_SEED=1 npx tsx scripts/seed-products.ts
 */

import { PrismaClient } from '@prisma/client'

if (process.env.ALLOW_PRODUCT_SEED !== '1') {
  console.error(
    'Seed megtagadva: a manuális termékek védelme érdekében állítsd be: ALLOW_PRODUCT_SEED=1\n' +
      'Példa: ALLOW_PRODUCT_SEED=1 npm run seed:products'
  )
  process.exit(1)
}

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
    isNew: false,
    onSale: false,
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: true,
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
  },
]

async function main() {
  console.log('Seeding products (create-only, meglévő slug-ok érintetlenek)...')
  for (const p of stockProducts) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log('  skip (már létezik):', p.slug)
      continue
    }
    await prisma.product.create({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description_hu: p.description_hu,
        description_en: p.description_en,
        description_de: p.description_de,
        condition: p.condition,
        category: p.category,
        image: p.image,
        images: p.images,
        images360: p.images360,
        modelUrl: p.modelUrl,
        priceHuf: p.priceHuf,
        priceEur: p.priceEur,
        stock: p.stock,
        variants: p.variants ?? undefined,
        isNew: p.isNew,
        onSale: p.onSale,
        type: p.type,
        sourcingEnabled: p.sourcingEnabled,
        isColorable: p.isColorable,
      },
    })
    console.log('  created', p.slug)
  }
  for (const p of sourcingDeals) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log('  skip sourcing (már létezik):', p.slug)
      continue
    }
    await prisma.product.create({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description_hu: p.description_hu,
        description_en: p.description_en,
        description_de: p.description_de,
        condition: p.condition,
        category: p.category,
        image: p.image,
        images: p.images,
        images360: p.images360,
        priceHuf: p.priceHuf,
        priceEur: p.priceEur,
        stock: p.stock,
        variants: p.variants ?? undefined,
        isNew: p.isNew,
        onSale: p.onSale,
        type: p.type,
        sourcingEnabled: p.sourcingEnabled,
        dealStartAt: p.dealStartAt,
        dealEndAt: p.dealEndAt,
        previewFrom: p.previewFrom,
        maxOrders: p.maxOrders,
        isColorable: p.isColorable,
      },
    })
    console.log('  created sourcing', p.slug)
  }
  console.log('Seed done (manuális termékek érintetlenek).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
