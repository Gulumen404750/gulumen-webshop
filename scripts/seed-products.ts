/**
 * Termékek seedelése az adatbázisba.
 * Futtatás: npx tsx scripts/seed-products.ts
 * A sourcing deal-eknek fix dealStartAt/dealEndAt van (seed időpont + offset), így deploy után nem resetelődnek.
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
    description: 'Minimalista roll-top hátizsák, vízálló anyag, elöl cipzáras zseb.',
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
    description: '3D nyomtatott növénykötöző (PLA), strap 80 mm. Ellenőrzött, saját tervezés.',
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
    description: 'Időzített beszerzéses ajánlat. Limitált darabszám, csak a vásárlási ablakban rendelhető.',
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
  console.log('Seeding products...')
  for (const p of stockProducts) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description: p.description,
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
      update: {
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description: p.description,
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
    console.log('  upserted', p.slug)
  }
  for (const p of sourcingDeals) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description: p.description,
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
      update: {
        name: p.name,
        nameEn: p.nameEn,
        nameDe: p.nameDe,
        nameRo: p.nameRo,
        description: p.description,
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
    console.log('  upserted sourcing', p.slug)
  }
  console.log('Seed done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
