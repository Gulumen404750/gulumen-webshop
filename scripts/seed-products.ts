/**
 * Termékek seedelése az adatbázisba (production bootstrap).
 * Futtatás: npm run seed:products
 * Csak hiányzó slug-okat hoz létre; meglévőknél csak üres mezőket tölt ki.
 */

import { PrismaClient, type Prisma, type Product } from '@prisma/client'

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
    description_ro: 'Rucsac roll-top minimalist, material impermeabil, buzunar frontal cu fermoar.',
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
    description_ro: 'Suport plante printat 3D (PLA), curea 80 mm. Verificat, design propriu.',
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
    description_ro: 'Suport șervețele printat 3D, inele stil lemn (PLA). Verificat, design propriu.',
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
    description_ro: 'Cleme organizator cabluri printată 3D (PLA). Se fixează pe marginea mesei sau perete.',
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
  ...([
    {
      id: '3d-4',
      slug: 'viragcserep-alatet',
      name: 'Virágcserép alátét',
      nameEn: 'Plant pot saucer',
      category: '3d-kert',
      priceHuf: 1590,
      priceEur: 4,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-5',
      slug: 'fuszertarto-doboz',
      name: 'Fűszertartó doboz',
      nameEn: 'Spice storage box',
      category: '3d-konyha',
      priceHuf: 2190,
      priceEur: 6,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-6',
      slug: 'tolltarto-minimal',
      name: 'Tolltartó – minimal',
      nameEn: 'Pen holder – minimal',
      category: '3d-iroda',
      priceHuf: 1790,
      priceEur: 5,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-7',
      slug: 'konyvjelzo-szett',
      name: 'Könyvjelző szett',
      nameEn: 'Bookmark set',
      category: '3d-dekor',
      priceHuf: 990,
      priceEur: 3,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-8',
      slug: 'ruhafogo-mini',
      name: 'Ruhafogó mini',
      nameEn: 'Mini clothes hanger',
      category: '3d-lakberendezes',
      priceHuf: 1490,
      priceEur: 4,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-9',
      slug: 'fali-fejkosar',
      name: 'Fali fejkosár',
      nameEn: 'Wall headband holder',
      category: '3d-furdoszoba',
      priceHuf: 1290,
      priceEur: 4,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-10',
      slug: 'jatekfigura-allvany',
      name: 'Játékfigura állvány',
      nameEn: 'Figurine display stand',
      category: '3d-hobby',
      priceHuf: 2490,
      priceEur: 6,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-11',
      slug: 'kulcstarto-tarto',
      name: 'Kulcstartó tartó',
      nameEn: 'Keychain holder',
      category: '3d-eloszoba',
      priceHuf: 1890,
      priceEur: 5,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-12',
      slug: 'szappantarto-lekerekített',
      name: 'Szappantartó – lekerekített',
      nameEn: 'Soap dish – rounded',
      category: '3d-furdoszoba',
      priceHuf: 1690,
      priceEur: 4,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-13',
      slug: 'csipteto-tarto',
      name: 'Csiptető tartó',
      nameEn: 'Clothespin holder',
      category: '3d-konyha',
      priceHuf: 1390,
      priceEur: 4,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-14',
      slug: 'parna-tarto-klipsz',
      name: 'Párna tartó klipsz',
      nameEn: 'Cushion clip holder',
      category: '3d-lakberendezes',
      priceHuf: 1190,
      priceEur: 3,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-15',
      slug: 'kabel-cimke-szett',
      name: 'Kábel címke szett',
      nameEn: 'Cable label set',
      category: '3d-eszkozok',
      priceHuf: 890,
      priceEur: 3,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-16',
      slug: 'asztali-papir-tarto',
      name: 'Asztali papír tartó',
      nameEn: 'Desk paper tray',
      category: '3d-iroda',
      priceHuf: 2790,
      priceEur: 7,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-17',
      slug: 'mini-viragvaza',
      name: 'Mini virágváza',
      nameEn: 'Mini flower vase',
      category: '3d-dekor',
      priceHuf: 1990,
      priceEur: 5,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-18',
      slug: 'ajandek-szalag-csevelo',
      name: 'Ajándék szalag csévélő',
      nameEn: 'Gift ribbon spool holder',
      category: '3d-hobby',
      priceHuf: 2290,
      priceEur: 6,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-19',
      slug: 'telefontarto-allvany',
      name: 'Telefontartó állvány',
      nameEn: 'Phone stand',
      category: '3d-iroda',
      priceHuf: 1590,
      priceEur: 4,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-20',
      slug: 'fulhallgato-tarto',
      name: 'Fülhallgató tartó',
      nameEn: 'Headphone holder',
      category: '3d-iroda',
      priceHuf: 2890,
      priceEur: 7,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-21',
      slug: 'poharalatet-szett',
      name: 'Poháralátét szett (4 db)',
      nameEn: 'Coaster set (4 pcs)',
      category: '3d-konyha',
      priceHuf: 1990,
      priceEur: 5,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-22',
      slug: 'szemuvegtarto-asztali',
      name: 'Szemüvegtartó – asztali',
      nameEn: 'Desktop glasses holder',
      category: '3d-iroda',
      priceHuf: 1490,
      priceEur: 4,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-23',
      slug: 'jatekkartya-tarto',
      name: 'Játékkártya tartó',
      nameEn: 'Playing card holder',
      category: '3d-hobby',
      priceHuf: 1290,
      priceEur: 4,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-24',
      slug: 'monitor-emelo',
      name: 'Monitor emelő',
      nameEn: 'Monitor riser',
      category: '3d-iroda',
      priceHuf: 3490,
      priceEur: 9,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-25',
      slug: 'furdoszobai-szappanado',
      name: 'Fürdőszobai szappanadó',
      nameEn: 'Bathroom soap saver',
      category: '3d-furdoszoba',
      priceHuf: 1090,
      priceEur: 3,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-26',
      slug: 'evokanal-tarto',
      name: 'Evőkanál tartó',
      nameEn: 'Spoon rest',
      category: '3d-konyha',
      priceHuf: 890,
      priceEur: 3,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-27',
      slug: 'fali-kapcsolo-vedo',
      name: 'Fali kapcsoló védő',
      nameEn: 'Wall switch guard',
      category: '3d-lakberendezes',
      priceHuf: 1190,
      priceEur: 3,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-28',
      slug: 'usb-kabel-tarto',
      name: 'USB kábel tartó',
      nameEn: 'USB cable holder',
      category: '3d-eszkozok',
      priceHuf: 990,
      priceEur: 3,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-29',
      slug: 'teljes-aru-termek-1',
      name: 'Teljes árú termék 1',
      nameEn: 'Full price product 1',
      category: '3d-konyha',
      priceHuf: 2990,
      priceEur: 8,
      image: '/img/demo/demo-taskav-teal.png',
    },
    {
      id: '3d-30',
      slug: 'teljes-aru-termek-2',
      name: 'Teljes árú termék 2',
      nameEn: 'Full price product 2',
      category: '3d-iroda',
      priceHuf: 3490,
      priceEur: 9,
      image: '/img/demo/demo-taskav-piros.png',
    },
    {
      id: '3d-31',
      slug: 'teljes-aru-termek-3',
      name: 'Teljes árú termék 3',
      nameEn: 'Full price product 3',
      category: '3d-kert',
      priceHuf: 3990,
      priceEur: 10,
      image: '/img/3d-noveny-kotozo.png',
    },
    {
      id: '3d-32',
      slug: 'teljes-aru-termek-4',
      name: 'Teljes árú termék 4',
      nameEn: 'Full price product 4',
      category: '3d-dekor',
      priceHuf: 4490,
      priceEur: 11,
      image: '/img/3d-szalveta-tarto.png',
    },
    {
      id: '3d-33',
      slug: 'teljes-aru-termek-5',
      name: 'Teljes árú termék 5',
      nameEn: 'Full price product 5',
      category: '3d-hobby',
      priceHuf: 4990,
      priceEur: 13,
      image: '/img/demo/demo-taskav-teal.png',
    },
  ] as const).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameEn: p.nameEn,
    nameDe: p.nameEn,
    nameRo: p.nameEn,
    description_hu: `3D nyomtatott teszttermék (PLA) – ${p.name}. Pontgyűjtés teszteléshez.`,
    description_en: `3D printed test product (PLA) – ${p.nameEn}. For points collection testing.`,
    description_de: `3D-gedrucktes Testprodukt (PLA) – ${p.nameEn}. Zum Testen der Punktesammlung.`,
    description_ro: `Produs test printat 3D (PLA) – ${p.nameEn}. Pentru testarea colectării punctelor.`,
    condition: 'Új',
    category: p.category,
    image: p.image,
    images: [p.image],
    images360: [] as string[],
    modelUrl: null as string | null,
    priceHuf: p.priceHuf,
    priceEur: p.priceEur,
    stock: 20,
    variants: null,
    isNew: true,
    onSale: false,
    type: 'stock' as const,
    sourcingEnabled: false,
    isColorable: true,
    active: true,
    archived: false,
  })),
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
    description_ro: 'Ofertă de aprovizionare limitată în timp. Cantitate limitată, comandabilă doar în fereastra de cumpărare.',
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

function productPayload(p: SeedProduct): Prisma.ProductUncheckedCreateInput {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameEn: p.nameEn,
    nameDe: p.nameDe,
    nameRo: p.nameRo,
    description_hu: p.description_hu,
    description_en: ('description_en' in p ? p.description_en : undefined) ?? '',
    description_de: ('description_de' in p ? p.description_de : undefined) ?? '',
    description_ro: p.description_ro || '',
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

function isBlankString(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

function isEmptyArray(value: unknown[] | null | undefined): boolean {
  return value == null || value.length === 0
}

/** Meglévő sor: csak üres / null mezők kitöltése seed értékkel (ár, készlet, státusz érintetlen). */
function buildEmptyFieldPatch(
  existing: Product,
  seed: Prisma.ProductUncheckedCreateInput
): Prisma.ProductUpdateInput {
  const patch: Prisma.ProductUpdateInput = {}

  const setStringIfBlank = (
    key: keyof Prisma.ProductUpdateInput,
    current: string | null | undefined,
    next: string | null | undefined
  ) => {
    if (isBlankString(current) && next != null && !isBlankString(next)) {
      ;(patch as Record<string, unknown>)[key as string] = next
    }
  }

  setStringIfBlank('name', existing.name, seed.name)
  setStringIfBlank('nameEn', existing.nameEn, seed.nameEn ?? null)
  setStringIfBlank('nameDe', existing.nameDe, seed.nameDe ?? null)
  setStringIfBlank('nameRo', existing.nameRo, seed.nameRo ?? null)
  setStringIfBlank('description_hu', existing.description_hu, seed.description_hu)
  setStringIfBlank('description_en', existing.description_en, seed.description_en)
  setStringIfBlank('description_de', existing.description_de, seed.description_de)
  setStringIfBlank('description_ro', existing.description_ro, seed.description_ro)
  setStringIfBlank('image', existing.image, seed.image)
  setStringIfBlank('modelUrl', existing.modelUrl, seed.modelUrl ?? null)

  if (isEmptyArray(existing.images)) {
    const nextImages = seed.images
    if (Array.isArray(nextImages) && nextImages.length > 0) {
      patch.images = nextImages
    }
  }
  if (isEmptyArray(existing.images360)) {
    const next360 = seed.images360
    if (Array.isArray(next360) && next360.length > 0) {
      patch.images360 = next360
    }
  }
  if (existing.variants == null && seed.variants != null) {
    patch.variants = seed.variants as Prisma.InputJsonValue
  }
  if (existing.discountPriceHuf == null && seed.discountPriceHuf != null) {
    patch.discountPriceHuf = seed.discountPriceHuf
  }
  if (existing.discountPriceEur == null && seed.discountPriceEur != null) {
    patch.discountPriceEur = seed.discountPriceEur
  }
  if (existing.saleStartAt == null && seed.saleStartAt != null) {
    patch.saleStartAt = seed.saleStartAt
  }
  if (existing.saleEndAt == null && seed.saleEndAt != null) {
    patch.saleEndAt = seed.saleEndAt
  }
  if (existing.dealStartAt == null && seed.dealStartAt != null) {
    patch.dealStartAt = seed.dealStartAt
  }
  if (existing.dealEndAt == null && seed.dealEndAt != null) {
    patch.dealEndAt = seed.dealEndAt
  }
  if (existing.previewFrom == null && seed.previewFrom != null) {
    patch.previewFrom = seed.previewFrom
  }
  if (existing.maxOrders == null && seed.maxOrders != null) {
    patch.maxOrders = seed.maxOrders
  }
  if (isBlankString(existing.category) && !isBlankString(seed.category)) {
    patch.category = seed.category
  }

  return patch
}

export async function seedProducts(): Promise<void> {
  let created = 0
  let skipped = 0

  for (const p of [...stockProducts, ...sourcingDeals]) {
    const data = productPayload(p)
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } })

    if (!existing) {
      await prisma.product.create({ data })
      created++
      continue
    }

    skipped++
    const patch = buildEmptyFieldPatch(existing, data)
    if (Object.keys(patch).length > 0) {
      await prisma.product.update({ where: { slug: p.slug }, data: patch })
    }
  }

  console.log(`[seed] created ${created}, skipped ${skipped} existing`)

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
