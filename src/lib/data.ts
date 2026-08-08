import { productSlugLookupCandidates } from '@/lib/slug'

export type Condition = 'Új' | 'Új, címkés' | 'Új kinézetű' | 'Kiváló' | 'Jó'

export type ProductType = 'stock' | 'sourcing_deal'

export type SourcingDealStatus = 'preview' | 'sale' | 'soldout' | 'closed'

/** Időzített vásárlás egységes státusza: gombok és checkout logikához. */
export type TimedPurchaseStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED'

/** Új termék: töltsd ki a name (magyar) mezőt; opcionálisan nameEn, nameDe, nameRo. Ha csak name van, minden nyelven az jelenik meg (getProductName fallback). */
export interface Product {
  id: string
  name: string
  nameEn: string
  nameDe?: string
  nameRo?: string
  slug: string
  priceHuf: number
  priceEur: number
  discountPriceHuf?: number
  discountPriceEur?: number
  condition: Condition
  category: string
  image: string
  /** Több kép: tömb feltöltése, a lapozás és galéria ezekkel működik. */
  images: string[]
  /** Opcionális 360° megtekintés: képkockák URL-jei (körbe húzva lapozható). */
  images360?: string[]
  /**
   * Színenkénti galéria: legacy map (id → képek) vagy ColorVariant tömb
   * ({ id, name, hex, images }[]). Shopban a képpel rendelkező színek jelennek meg.
   */
  colorImages?: Record<string, string[]> | import('@/lib/filamentColors').ColorVariant[]
  /** 3D termék: GLB modell URL (pl. /models/noveny-kotozo.glb), körbe forgatható megjelenítéshez. */
  modelUrl?: string
  /**
   * Készlet:
   * - negatív (pl. -1) vagy null/undefined → végtelen / „Készleten”
   * - 0 → elfogyott
   * - pozitív → pontos darabszám
   */
  stock: number
  variants?: { size?: string; color?: string }[]
  /** Leírás (mock: egyetlen mező; DB: getProductDescription használja a _hu/_en/_de mezőket). */
  description: string
  /** Többnyelvű leírás (DB). Fallback: hu → en → de → ro. */
  description_hu?: string
  description_en?: string
  description_de?: string
  description_ro?: string
  isNew?: boolean
  onSale?: boolean
  /** Storefront láthatóság (DB). Mock módban a storefront-config szűr. */
  active?: boolean
  archived?: boolean
  /** Időzített akció kezdete/vége (ISO string). */
  saleStartAt?: string
  saleEndAt?: string
  type?: ProductType
  previewFrom?: string
  saleFrom?: string
  saleTo?: string
  maxOrders?: number
  ordersCount?: number
  /** Kedvelések száma (FOMO) – csak stock és sourcing_deal termékeknél. */
  likesCount?: number
  /** 3D termék színezhető (filament színválasztó megjelenik, kosárba megy a kiválasztott szín). */
  isColorable?: boolean
}

/** Mock mód: egyetlen időpont a sourcing deal saleFrom/saleTo generáláshoz; node folyamat életében stabil (első hívásnál rögzítve). */
const GLOBAL_SEED_KEY = '__gulumen_sourcing_seed_now__'
function getSeedNow(): Date {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>)[GLOBAL_SEED_KEY] instanceof Date) {
    return (globalThis as unknown as Record<string, Date>)[GLOBAL_SEED_KEY]
  }
  const now = new Date()
  if (typeof globalThis !== 'undefined') (globalThis as unknown as Record<string, Date>)[GLOBAL_SEED_KEY] = now
  return now
}
let SEED_NOW: Date | null = null

/**
 * Terméknév a kiválasztott nyelv szerint.
 * Ha nincs fordítás (nameEn/nameDe/nameRo), mindig a magyar (name) jelenik meg,
 * így magyarul felvitt termékek minden nyelven látszanak, amíg nincs külön fordítás.
 */
export function getProductName(product: Product, locale: string): string {
  let name = ''
  switch (locale) {
    case 'hu':
      name = product.name
      break
    case 'en':
      name = product.nameEn ?? product.name
      break
    case 'de':
      name = product.nameDe ?? product.nameEn ?? product.name
      break
    case 'ro':
      name = product.nameRo ?? product.nameEn ?? product.name
      break
    default:
      name = product.nameEn ?? product.name
  }
  return (name && name.trim()) ? name : (product.slug || product.id)
}

/**
 * Termékleírás a kiválasztott nyelv szerint.
 * Fallback megjelenítés: 1. aktuális nyelv 2. angol 3. magyar.
 */
export function getProductDescription(product: Product, locale: string): string {
  const hu = product.description_hu ?? product.description ?? ''
  const en = product.description_en ?? product.description ?? ''
  const de = product.description_de ?? product.description ?? ''
  const ro = product.description_ro ?? product.description ?? ''
  const byLocale: Record<string, string> = { hu, en, de, ro }
  const current = byLocale[locale] || en
  return current || en || hu
}

export function getSourcingDealStatus(
  product: Product,
  now: Date = new Date(),
  ordersCountOverride?: number
): SourcingDealStatus | null {
  if (product.type !== 'sourcing_deal' || !product.saleFrom || !product.saleTo || product.maxOrders == null) return null
  const count = ordersCountOverride ?? product.ordersCount ?? 0
  if (count >= product.maxOrders) return 'soldout'
  const t = now.getTime()
  const previewFrom = new Date(product.previewFrom!).getTime()
  const saleFrom = new Date(product.saleFrom).getTime()
  const saleTo = new Date(product.saleTo).getTime()
  if (t < previewFrom) return null
  if (t > saleTo) return 'closed'
  if (t >= saleFrom) return 'sale'
  return 'preview'
}

/** Kliens–szerver óra eltérés miatt: ha saleTo már ennyi ms-n belül van, „lejártnak” tekintjük (nem jelenik meg aktív listán, de megjelenik a Lejárt termékeknél). Generózus buffer. */
export const SOURCING_EXPIRED_BUFFER_MS = 30_000

/** Igaz, ha az ajánlat már lejártnak tekintendő (lejárt vagy a buffer miatt „már majdnem lejárt”). Így frissítéskor a termék nem marad a Beszerzésre rendelhetőn, hanem a Lejárt termékek közé kerül. */
export function isSourcingConsideredExpired(
  product: Product,
  serverNow: number,
  _ordersCount?: number
): boolean {
  if (product.type !== 'sourcing_deal' || !product.saleTo) return false
  const saleToMs = new Date(product.saleTo).getTime()
  return saleToMs <= serverNow + SOURCING_EXPIRED_BUFFER_MS
}

/**
 * Időzített vásárlás státusza: availableFrom = saleFrom (indul), availableUntil = saleTo (lejár).
 * NOT_STARTED = még nem vehető, ACTIVE = vehető, EXPIRED = lejárt vagy elfogyott.
 */
export function getTimedPurchaseStatus(
  product: Product,
  now: Date = new Date(),
  ordersCountOverride?: number
): TimedPurchaseStatus | null {
  if (product.type !== 'sourcing_deal' || !product.saleFrom || !product.saleTo) return null
  const detail = getSourcingDealStatus(product, now, ordersCountOverride)
  if (detail === 'soldout' || detail === 'closed') return 'EXPIRED'
  if (detail === 'sale') return 'ACTIVE'
  if (detail === 'preview' || detail === null) return 'NOT_STARTED'
  return 'NOT_STARTED'
}

/** Beszerzésre rendelhető listán megjelenítendő rövid név: csak az időzítés (pl. "8 nap múlva vásárolható", "3 napig rendelhető"). */
export function getSourcingDealListName(product: Product, now: Date = new Date()): string {
  const status = getSourcingDealStatus(product, now)
  if (!status) return 'Hamarosan'
  if (status === 'soldout') return 'Elkelt'
  if (status === 'closed') return 'Lejárt'
  const msPerDay = 24 * 60 * 60 * 1000
  if (status === 'preview' && product.saleFrom) {
    const saleFrom = new Date(product.saleFrom).getTime()
    const days = Math.max(0, Math.ceil((saleFrom - now.getTime()) / msPerDay))
    return `${days} nap múlva vásárolható`
  }
  if (status === 'sale' && product.saleTo) {
    const saleTo = new Date(product.saleTo).getTime()
    const days = Math.max(0, Math.ceil((saleTo - now.getTime()) / msPerDay))
    return `${days} napig rendelhető`
  }
  return product.name
}

export type AddToCartResult = {
  canAdd: boolean
  reasonKey?: string
  reasonParams?: Record<string, string | number>
}

/** Megmondja, kosárba tehető-e a termék, és ha nem, fordítási kulcs + paraméterek a letiltott gombhoz. */
export function getAddToCartReason(
  product: Product,
  now: Date = new Date(),
  ordersCountOverride?: number
): AddToCartResult {
  if (product.type === 'sourcing_deal') {
    const status = getSourcingDealStatus(product, now, ordersCountOverride)
    if (status === 'sale') return { canAdd: true }
    if (status === 'preview' && product.saleFrom) {
      const saleFrom = new Date(product.saleFrom)
      const when = saleFrom.toLocaleString('hu-HU', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
      return { canAdd: false, reasonKey: 'addToCartReason.previewStarts', reasonParams: { when } }
    }
    if (status === 'soldout') {
      const serverOrders = product.ordersCount ?? 0
      const maxOrders = product.maxOrders ?? 0
      const available = Math.max(0, maxOrders - serverOrders)
      if (available <= 0) return { canAdd: false, reasonKey: 'status.soldOut' }
      return { canAdd: false, reasonKey: 'sourcing.availableCount', reasonParams: { count: available } }
    }
    if (status === 'closed') return { canAdd: false, reasonKey: 'status.expired' }
    return { canAdd: false, reasonKey: 'addToCartReason.previewNotStarted' }
  }
  if (isUnlimitedStock(product)) return { canAdd: true }
  const stock = Math.max(0, product.stock ?? 0)
  if (stock <= 0) return { canAdd: false, reasonKey: 'status.soldOut' }
  return { canAdd: true }
}

/**
 * Végtelen / nem számozott készlet: stock < 0 (admin üresen hagyta → -1).
 * Legacy: 3D termék stock === 0 is végtelennek számít (korábbi viselkedés).
 */
export function isUnlimitedStock(product: Product): boolean {
  if (product.type === 'sourcing_deal') return false
  if (product.stock == null || product.stock < 0) return true
  if (product.stock === 0 && is3DProduct(product)) return true
  return false
}

/**
 * Kijelzett készlet a termék típusa szerint.
 * - unlimited → UNLIMITED_STOCK_CAP (UI: „Készleten”, darabszám nélkül)
 * - stock: product.stock
 * - sourcing_deal: maxOrders - ordersCount (rendelhető maradék)
 */
export function getDisplayStock(product: Product, ordersCountOverride?: number): number {
  if (product.type === 'sourcing_deal') {
    const maxOrders = product.maxOrders ?? 0
    const count = ordersCountOverride ?? product.ordersCount ?? 0
    return Math.max(0, maxOrders - count)
  }
  if (isUnlimitedStock(product)) return UNLIMITED_STOCK_CAP
  return Math.max(0, product.stock ?? 0)
}

/**
 * Készlet kizárólag a canonical mockProducts-ból. A kosár NEM foglal készletet.
 *
 * Szabályok (Hibaelhárítási útmutató):
 * - Displayed Stock (kijelzett készlet): mindig getStockById(id) – a teljes stock, soha ne vonjuk le a kosár mennyiségét.
 * - Cart Quantity (kosárban lévő): külön, pl. "Kosárban: X db".
 * - Max in cart (max. kosárban): getMaxQty(product) = getStockById(id) készletes terméknél; validáció: cartQty + addQty <= getMaxQty.
 */
/** Végtelen készletnél ennyi db-ig lehet egyszerre választani a kosárban. */
export const UNLIMITED_STOCK_CAP = 999
/** Admin üres készletmező → ezt mentjük (végtelen / készleten). */
export const UNLIMITED_STOCK_VALUE = -1

export function getStockById(productId: string): number {
  const p = mockProducts.find((x) => x.id === productId)
  if (!p) return 0
  if (isUnlimitedStock(p)) return UNLIMITED_STOCK_CAP
  return Math.max(0, p.stock ?? 0)
}

/**
 * Maximum összesen kosárban tartható mennyiség (kosár limit). A kosár NEM csökkenti a készlet kijelzést.
 * Készletes terméknél: getStockById(product.id) – mind a 20 db berakható, ha stock=20.
 *
 * - stock: maxQty = getStockById(product.id)
 * - sourcing_deal: maxQty = maxOrders - ordersCount (preview/soldout/closed → 0)
 */
export function getMaxQty(
  product: Product | undefined | null,
  ordersCountOverride?: number
): number {
  if (!product) return 0
  if (product.type === 'sourcing_deal') {
    const status = getSourcingDealStatus(product, new Date(), ordersCountOverride)
    if (status === 'preview' || status === 'soldout' || status === 'closed') return 0
    const maxOrders = product.maxOrders ?? 0
    const count = ordersCountOverride ?? product.ordersCount ?? 0
    return Math.max(0, maxOrders - count)
  }
  if (isUnlimitedStock(product)) return UNLIMITED_STOCK_CAP
  return Math.max(0, product.stock ?? 0)
}

export const categories = [
  { slug: 'taskak', name: 'Táskák', nameEn: 'Bags', nameDe: 'Taschen', nameRo: 'Genți', storefrontVisible: false },
  { slug: 'ruhazat', name: 'Ruházat', nameEn: 'Clothing', nameDe: 'Kleidung', nameRo: 'Îmbrăcăminte', storefrontVisible: false },
  { slug: 'kiegeszitok', name: 'Kiegészítők', nameEn: 'Accessories', nameDe: 'Accessoires', nameRo: 'Accesorii', storefrontVisible: false },
  { slug: 'elektronika', name: 'Elektronika / Egyéb', nameEn: 'Electronics & More', nameDe: 'Elektronik & Mehr', nameRo: 'Electronică și altele', storefrontVisible: false },
  { slug: 'otthon', name: 'Otthon', nameEn: 'Home', nameDe: 'Zuhause', nameRo: 'Casă', storefrontVisible: false },
  { slug: '3d-nyomtatott', name: '3D Nyomtatott Termékek', nameEn: '3D Printed Products', nameDe: '3D-Druck Produkte', nameRo: 'Produse printate 3D', storefrontVisible: true },
] as const

/** Nav és shop: jelenleg látható kategóriák (a többi rejtett, de megmarad). */
export function getStorefrontCategories() {
  return categories.filter((c) => c.storefrontVisible)
}

/** 3D nyomtatott alkategóriák (fülek) – slug = product.category érték. */
export const threeDSubcategories = [
  { slug: '3d-otthon', name: 'Otthon', nameEn: 'Home', nameDe: 'Zuhause', nameRo: 'Casă', icon: '🏠' },
  { slug: '3d-konyha', name: 'Konyha', nameEn: 'Kitchen', nameDe: 'Küche', nameRo: 'Bucătărie', icon: '🍳' },
  { slug: '3d-jatek', name: 'Játék', nameEn: 'Toys', nameDe: 'Spielzeug', nameRo: 'Jocuri', icon: '🧸' },
  { slug: '3d-kert', name: 'Kert', nameEn: 'Garden', nameDe: 'Garten', nameRo: 'Grădină', icon: '🌿' },
  { slug: '3d-lakasdekor', name: 'Lakásdekor', nameEn: 'Home decor', nameDe: 'Wohndekor', nameRo: 'Decor interior', icon: '🏠' },
  { slug: '3d-eszkozok', name: 'Eszközök', nameEn: 'Tools', nameDe: 'Werkzeuge', nameRo: 'Unelte', icon: '🔧' },
  { slug: '3d-kreativ', name: 'Kreatív', nameEn: 'Creative', nameDe: 'Kreativ', nameRo: 'Creativ', icon: '🧩' },
  { slug: '3d-ajandek', name: 'Ajándék', nameEn: 'Gift', nameDe: 'Geschenk', nameRo: 'Cadou', icon: '🎁' },
] as const

export type ThreeDSubcategorySlug = (typeof threeDSubcategories)[number]['slug']

/** Termék 3D nyomtatott, ha category 3d- prefixű. */
export function is3DProduct(product: Product): boolean {
  return (product.category?.startsWith?.('3d-') ?? false)
}

/** Kategória neve a kiválasztott nyelv szerint. */
export function getCategoryName(
  cat: { name: string; nameEn: string; nameDe?: string; nameRo?: string },
  locale: string
): string {
  switch (locale) {
    case 'hu':
      return cat.name
    case 'de':
      return cat.nameDe ?? cat.nameEn
    case 'ro':
      return cat.nameRo ?? cat.nameEn
    default:
      return cat.nameEn
  }
}

export const mockProducts: Product[] = [
  {
    id: '7',
    name: 'Roll-top hátizsák – fekete',
    nameEn: 'Roll-top backpack – black',
    nameDe: 'Roll-top Rucksack – schwarz',
    nameRo: 'Rucsac roll-top – negru',
    slug: 'rolltop-hatizsak-fekete-1',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-fekete-1.png',
    images: ['/img/rolltop-fekete-1.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Fekete' }],
    description: 'Minimalista roll-top hátizsák, vízálló anyag, elöl cipzáras zseb. Fekete szín, fekete pántok és cipzár.',
    isNew: true,
  },
  {
    id: '8',
    name: 'Roll-top hátizsák – fekete (ENJOY)',
    nameEn: 'Roll-top backpack – black (ENJOY)',
    slug: 'rolltop-hatizsak-fekete-2',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-fekete-2.png',
    images: ['/img/rolltop-fekete-2.png', '/img/rolltop-fekete-1.png', '/img/rolltop-fekete-3.png'],
    images360: ['/img/rolltop-fekete-2.png', '/img/rolltop-fekete-1.png', '/img/rolltop-fekete-3.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Fekete' }],
    description: 'Stílusos fekete roll-top hátizsák, oldalsó cipzáras és nyitott zseb. Erősített fekete alj, ENJOY márka.',
    isNew: true,
  },
  {
    id: '9',
    name: 'Roll-top hátizsák – fekete (Enjoy the Trip)',
    nameEn: 'Roll-top backpack – black (Enjoy the Trip)',
    slug: 'rolltop-hatizsak-fekete-3',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-fekete-3.png',
    images: ['/img/rolltop-fekete-3.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Fekete' }],
    description: 'Minimalista fekete roll-top hátizsák, középen kapcsos pánt, oldalsó cipzáras zseb. Tisztán, praktikusan.',
    isNew: true,
  },
  {
    id: '10',
    name: 'Roll-top hátizsák – szürke',
    nameEn: 'Roll-top backpack – grey',
    slug: 'rolltop-hatizsak-szurke-1',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-szurke-1.png',
    images: ['/img/rolltop-szurke-1.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Szürke' }],
    description: 'Szürke roll-top hátizsák, elöl cipzáras zseb, fekete pántok és cipzár. Egyszerű, modern formák.',
    isNew: true,
  },
  {
    id: '11',
    name: 'Roll-top hátizsák – szürke (ENJOY)',
    nameEn: 'Roll-top backpack – grey (ENJOY)',
    slug: 'rolltop-hatizsak-szurke-2',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-szurke-2.png',
    images: ['/img/rolltop-szurke-2.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Szürke' }],
    description: 'Közép-szürke roll-top hátizsák, oldalsó cipzáras zseb, ENJOY címke. Fekete pántok és cipzár.',
    isNew: true,
  },
  {
    id: '12',
    name: 'Roll-top hátizsák – szürke, fekete alj',
    nameEn: 'Roll-top backpack – grey with black base',
    slug: 'rolltop-hatizsak-szurke-3',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-szurke-3.png',
    images: ['/img/rolltop-szurke-3.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Szürke' }],
    description: 'Szürke roll-top hátizsák fekete erősített aljjal, elöl átlós cipzáras zseb. ENJOY márka, strapabíró anyag.',
    isNew: true,
  },
  {
    id: '13',
    name: 'Roll-top hátizsák – bézs',
    nameEn: 'Roll-top backpack – beige',
    slug: 'rolltop-hatizsak-bezs-1',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-tan-1.png',
    images: ['/img/rolltop-tan-1.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Bézs' }],
    description: 'Világos barna/bézs roll-top hátizsák, fekete pánt és cipzár. Nagy előzseb, letisztult design.',
    isNew: true,
  },
  {
    id: '14',
    name: 'Roll-top hátizsák – világosbézs',
    nameEn: 'Roll-top backpack – light tan',
    slug: 'rolltop-hatizsak-bezs-2',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-tan-2.png',
    images: ['/img/rolltop-tan-2.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Világosbézs' }],
    description: 'Világos bézs/tan roll-top hátizsák, elöl függőleges cipzáras zseb. Sima anyag, vízálló megjelenés.',
    isNew: true,
  },
  {
    id: '15',
    name: 'Roll-top hátizsák – mustár sárga',
    nameEn: 'Roll-top backpack – mustard yellow',
    slug: 'rolltop-hatizsak-sarga',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-sarga.png',
    images: ['/img/rolltop-sarga.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Mustár sárga' }],
    description: 'Élénk mustár sárga roll-top hátizsák, fekete pántok és cipzár. Elöl vízszintes cipzáras zseb.',
    isNew: true,
  },
  {
    id: '16',
    name: 'Roll-top hátizsák – olívazöld',
    nameEn: 'Roll-top backpack – olive green',
    slug: 'rolltop-hatizsak-olivazold-1',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-olajzold-1.png',
    images: ['/img/rolltop-olajzold-1.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Olívazöld' }],
    description: 'Olívazöld roll-top hátizsák, fekete alj és pántok. Elöl cipzáras zseb, ENJOY – MADE IN EUROPE.',
    isNew: true,
  },
  {
    id: '17',
    name: 'Roll-top hátizsák – olívazöld (ENJOY)',
    nameEn: 'Roll-top backpack – olive green (ENJOY)',
    slug: 'rolltop-hatizsak-olivazold-2',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-olajzold-2.png',
    images: ['/img/rolltop-olajzold-2.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Olívazöld' }],
    description: 'Olívazöld roll-top hátizsák, két kapcsos pánt, oldalsó cipzáras és nyitott zseb. ENJOY márka.',
    isNew: true,
  },
  {
    id: '18',
    name: 'Roll-top hátizsák – piros',
    nameEn: 'Roll-top backpack – red',
    slug: 'rolltop-hatizsak-piros-1',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-piros-1.png',
    images: ['/img/rolltop-piros-1.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Piros' }],
    description: 'Élénk piros roll-top hátizsák, fekete pánt és cipzár. Elöl függőleges cipzáras zseb, letisztult.',
    isNew: true,
  },
  {
    id: '19',
    name: 'Roll-top hátizsák – piros (ENJOY LAB)',
    nameEn: 'Roll-top backpack – red (ENJOY LAB)',
    slug: 'rolltop-hatizsak-piros-2',
    priceHuf: 11990,
    priceEur: 31,
    condition: 'Új',
    category: 'taskak',
    image: '/img/rolltop-piros-2.png',
    images: ['/img/rolltop-piros-2.png'],
    stock: 1,
    variants: [{ size: 'One size', color: 'Piros' }],
    description: 'Piros roll-top hátizsák ENJOY LAB márkával. Oldalsó cipzáras zseb, vízálló cipzár, MADE SIMPLE.',
    isNew: true,
  },
  {
    id: '20',
    name: 'Sendia pléd – világosszürke, hópiros (150x200 cm)',
    nameEn: 'Sendia blanket – light grey, snowflake (150x200 cm)',
    slug: 'sendia-pled-vilagosszurke-hopiros',
    priceHuf: 5680,
    priceEur: 15,
    condition: 'Új, címkés',
    category: 'otthon',
    image: '/img/sendia-pled-1.png',
    images: ['/img/sendia-pled-1.png'],
    stock: 1,
    description: 'SENDIA® plüss pléd, 100% poliészter. 150x200 cm. Hópirosos mintás, karácsonyos csomagolás.',
    onSale: true,
  },
  {
    id: '21',
    name: 'Sendia ágytakaró pléd – fehér, zöld mintás (200x230 cm)',
    nameEn: 'Sendia bedspread blanket – white, green pattern (200x230 cm)',
    slug: 'sendia-pled-feher-zold',
    priceHuf: 5680,
    priceEur: 15,
    condition: 'Új, címkés',
    category: 'otthon',
    image: '/img/sendia-pled-2.png',
    images: ['/img/sendia-pled-2.png'],
    stock: 1,
    description: 'SENDIA® ágytakaró pléd, 100% poliészter. 200x230 cm. Fehér alapon sötétzöld fenyőágas/hópirosos minta.',
    onSale: true,
  },
  {
    id: '22',
    name: 'Sendia műszőrme pléd – szürke (150x200 cm)',
    nameEn: 'Sendia faux fur blanket – grey (150x200 cm)',
    slug: 'sendia-pled-muszorome-szurke',
    priceHuf: 5680,
    priceEur: 15,
    condition: 'Új, címkés',
    category: 'otthon',
    image: '/img/sendia-pled-3.png',
    images: ['/img/sendia-pled-3.png'],
    stock: 1,
    description: 'SENDIA® plüss/műszőrme pléd, 100% poliészter. 150x200 cm. Puha, szürke szín, karácsonyos csomagolás.',
    onSale: true,
  },
  {
    id: '23',
    name: 'Sendia ágytakaró pléd – világosszürke (150x200 cm)',
    nameEn: 'Sendia bedspread blanket – light grey (150x200 cm)',
    slug: 'sendia-pled-vilagosszurke',
    priceHuf: 5680,
    priceEur: 15,
    condition: 'Új, címkés',
    category: 'otthon',
    image: '/img/sendia-pled-4.png',
    images: ['/img/sendia-pled-4.png'],
    stock: 1,
    description: 'SENDIA® ágytakaró pléd, 100% poliészter. 150x200 cm. Puha plüss, világosszürke, téli csomagolás.',
    onSale: true,
  },
  {
    id: '24',
    name: 'Sendia ágytakaró pléd – piros, hópirosos (180x200 cm)',
    nameEn: 'Sendia bedspread blanket – red, snowflake (180x200 cm)',
    slug: 'sendia-pled-piros-hopiros',
    priceHuf: 5680,
    priceEur: 15,
    condition: 'Új, címkés',
    category: 'otthon',
    image: '/img/sendia-pled-5.png',
    images: ['/img/sendia-pled-5.png'],
    stock: 1,
    description: 'SENDIA® ágytakaró pléd, 100% poliészter. 180x200 cm. Piros alapon fehér hópirosos minta.',
    onSale: true,
  },
  // 3D nyomtatott termékek (kategória = 3d-*)
  ...get3DMockProducts(),
]

function addDays(d: Date, days: number): string {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out.toISOString()
}

function addMinutes(d: Date, minutes: number): string {
  const out = new Date(d)
  out.setMinutes(out.getMinutes() + minutes)
  return out.toISOString()
}

function getSourcingDealMockProducts(): Product[] {
  if (SEED_NOW === null) SEED_NOW = getSeedNow()
  const now = SEED_NOW
  return [
  {
    id: 'sd-1',
      name: 'Limitált beszerzés – Premium hátizsák',
      nameEn: 'Limited sourcing – Premium backpack',
      nameDe: 'Limitierte Beschaffung – Premium-Rucksack',
      nameRo: 'Aprovizionare limitată – Rucsac premium',
      slug: 'beszerzes-premium-hatizsak',
      priceHuf: 14990,
      priceEur: 38,
      condition: 'Új',
      category: 'taskak',
      image: '/img/rolltop-fekete-1.png',
      images: ['/img/rolltop-fekete-1.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Limitált darabszám, csak a vásárlási ablakban rendelhető.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -2),
      saleFrom: addDays(now, 12),
      saleTo: addDays(now, 15),
      maxOrders: 10,
      ordersCount: 0,
    },
  {
    id: 'sd-2',
      name: 'Limitált beszerzés – Sendia pléd készlet',
      nameEn: 'Limited sourcing – Sendia blanket stock',
      nameDe: 'Limitierte Beschaffung – Sendia Decken-Sortiment',
      nameRo: 'Aprovizionare limitată – Stoc plăci Sendia',
      slug: 'beszerzes-sendia-pled',
      priceHuf: 4990,
      priceEur: 13,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/sendia-pled-1.png',
      images: ['/img/sendia-pled-1.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. 3 napig rendelhető, limitált darabszám.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -20),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 2),
      maxOrders: 5,
      ordersCount: 0,
    },
    /* Teszt: maxOrders=1 – race condition / oversell teszthez (scripts/test-2-sourcing-race.ps1). */
    {
      id: 'sd-race-1',
      name: 'Teszt 1 slot (race teszt)',
      nameEn: 'Test 1 slot (race test)',
      slug: 'beszerzes-teszt-1-slot',
      priceHuf: 1000,
      priceEur: 3,
      condition: 'Új',
      category: 'taskak',
      image: '/img/rolltop-fekete-1.png',
      images: ['/img/rolltop-fekete-1.png'],
      stock: 0,
      description: 'Csak teszt: maxOrders=1, oversell teszt.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -1),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 2),
      maxOrders: 1,
      ordersCount: 0,
    },
    /* Teszt termék: indul 2 perc múlva, lejár 5 perc múlva (a szerver indulásától). Dev szerver újraindítás után 2–5 percig aktív. */
    {
      id: 'sd-test-timer',
      name: 'Teszt időzített ajánlat (2–5 perc)',
      nameEn: 'Test timed offer (2–5 min)',
      slug: 'beszerzes-teszt-idozitett',
      priceHuf: 1000,
      priceEur: 3,
      condition: 'Új',
      category: 'taskak',
      image: '/img/rolltop-fekete-1.png',
      images: ['/img/rolltop-fekete-1.png'],
      stock: 0,
      description: 'Csak teszt: vásárlás 2 perc múlva indul, 5 perc múlva jár le.',
      type: 'sourcing_deal',
      previewFrom: addMinutes(now, -1),
      saleFrom: addMinutes(now, 2),
      saleTo: addMinutes(now, 5),
      maxOrders: 5,
      ordersCount: 0,
    },
  {
    id: 'sd-3',
      name: 'Roll-top hátizsák – piros',
      nameEn: 'Roll-top backpack – red',
      nameDe: 'Roll-top Rucksack – rot',
      nameRo: 'Rucsac roll-top – roșu',
      slug: 'beszerzes-rolltop-piros',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-1.png',
      images: ['/img/beszerzes-1.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Piros roll-top hátizsák, strapabíró anyag, elöl cipzáras zseb. 8 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 8),
      saleTo: addDays(now, 11),
      maxOrders: 15,
      ordersCount: 0,
    },
    {
      id: 'sd-4',
      name: 'Roll-top hátizsák – sárga',
      nameEn: 'Roll-top backpack – yellow',
      slug: 'beszerzes-rolltop-sarga',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-2.png',
      images: ['/img/beszerzes-2.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Élénk sárga roll-top hátizsák, vízálló megjelenés. 8 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 8),
      saleTo: addDays(now, 11),
      maxOrders: 15,
      ordersCount: 0,
    },
    {
      id: 'sd-5',
      name: 'Roll-top hátizsák – szürke',
      nameEn: 'Roll-top backpack – grey',
      slug: 'beszerzes-rolltop-szurke',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-3.png',
      images: ['/img/beszerzes-3.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Közép-szürke roll-top hátizsák, letisztult design. 8 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 8),
      saleTo: addDays(now, 11),
      maxOrders: 15,
      ordersCount: 0,
    },
    {
      id: 'sd-6',
      name: 'Roll-top hátizsák – olívazöld ENJOY',
      nameEn: 'Roll-top backpack – olive green ENJOY',
      slug: 'beszerzes-rolltop-olivazold',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-4.png',
      images: ['/img/beszerzes-4.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Olívazöld roll-top hátizsák, ENJOY márka. 12 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 12),
      saleTo: addDays(now, 15),
      maxOrders: 15,
      ordersCount: 0,
    },
    {
      id: 'sd-7',
      name: 'Roll-top hátizsák – olívazöld',
      nameEn: 'Roll-top backpack – olive green',
      slug: 'beszerzes-rolltop-olivazold-2',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-5.png',
      images: ['/img/beszerzes-5.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Olívazöld roll-top, fekete aljjal. 12 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 12),
      saleTo: addDays(now, 15),
      maxOrders: 15,
      ordersCount: 0,
    },
    {
      id: 'sd-8',
      name: 'Roll-top hátizsák – bézs, vízálló',
      nameEn: 'Roll-top backpack – beige waterproof',
      slug: 'beszerzes-rolltop-bezs',
      priceHuf: 11990,
      priceEur: 31,
      condition: 'Új',
      category: 'taskak',
      image: '/img/beszerzes-6.png',
      images: ['/img/beszerzes-6.png'],
      stock: 0,
      description: 'Időzített beszerzéses ajánlat. Bézs roll-top hátizsák, vízálló anyag. 12 nap múlva indul a vásárlás.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -5),
      saleFrom: addDays(now, 12),
      saleTo: addDays(now, 15),
      maxOrders: 15,
      ordersCount: 0,
    },
    // Sendia ágytakaró plédek – már vásárolható, különböző lejárati időpontokkal
    {
      id: 'sd-9',
      name: 'Sendia ágytakaró pléd – szürke',
      nameEn: 'Sendia blanket – grey',
      slug: 'beszerzes-pled-szurke',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-1.png',
      images: ['/img/beszerzes-pled-1.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 180×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 1),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-10',
      name: 'Sendia ágytakaró pléd – sötétszürke',
      nameEn: 'Sendia blanket – dark grey',
      slug: 'beszerzes-pled-sotet-szurke',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-2.png',
      images: ['/img/beszerzes-pled-2.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 180×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 2),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-11',
      name: 'Sendia ágytakaró pléd – világosszürke',
      nameEn: 'Sendia blanket – light grey',
      slug: 'beszerzes-pled-vilagos-szurke',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-3.png',
      images: ['/img/beszerzes-pled-3.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 150×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 3),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-12',
      name: 'Sendia ágytakaró pléd – terracotta',
      nameEn: 'Sendia blanket – terracotta',
      slug: 'beszerzes-pled-terracotta',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-4.png',
      images: ['/img/beszerzes-pled-4.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 180×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 4),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-13',
      name: 'Sendia ágytakaró pléd – világosbarna',
      nameEn: 'Sendia blanket – light brown',
      slug: 'beszerzes-pled-vilagos-barna',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-5.png',
      images: ['/img/beszerzes-pled-5.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 150×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 5),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-14',
      name: 'Sendia ágytakaró pléd – piros',
      nameEn: 'Sendia blanket – red',
      slug: 'beszerzes-pled-piros',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-6.png',
      images: ['/img/beszerzes-pled-6.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 180×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 6),
      maxOrders: 20,
      ordersCount: 0,
    },
    {
      id: 'sd-15',
      name: 'Sendia ágytakaró pléd – bézs',
      nameEn: 'Sendia blanket – beige',
      slug: 'beszerzes-pled-bezs',
      priceHuf: 5680,
      priceEur: 15,
      condition: 'Új, címkés',
      category: 'otthon',
      image: '/img/beszerzes-pled-7.png',
      images: ['/img/beszerzes-pled-7.png'],
      stock: 0,
      description: 'SENDIA® ágytakaró pléd, 100% poliészter, 180×200 cm. Már vásárolható, limitált időig.',
      type: 'sourcing_deal',
      previewFrom: addDays(now, -10),
      saleFrom: addDays(now, -1),
      saleTo: addDays(now, 7),
      maxOrders: 20,
      ordersCount: 0,
    },
  ]
}

/** Csak a 2 ellenőrzött 3D termék: Növény kötöző (plantssupportstrapl80.stl), Szalvéta tartó (krouzek stromecek.stl). */
function get3DMockProducts(): Product[] {
  return [
    {
      id: '3d-1',
      name: 'Növény kötöző',
      nameEn: 'Plant support strap',
      nameDe: 'Pflanzenstütze',
      nameRo: 'Suport plante',
      slug: 'noveny-kotozo',
      priceHuf: 2490,
      priceEur: 6,
      condition: 'Új',
      category: '3d-kert',
      image: '/img/3d-noveny-kotozo.png',
      images: ['/img/3d-noveny-kotozo.png'],
      modelUrl: '/models/noveny-kotozo.glb',
      stock: 10,
      isColorable: true,
      description: '3D nyomtatott növénykötöző (PLA), strap 80 mm. Ellenőrzött, saját tervezés. Ideális kerti és benti növényekhez.',
      type: 'stock',
      active: true,
      isNew: true,
    },
    {
      id: '3d-2',
      name: 'Szalvéta tartó – körök',
      nameEn: 'Napkin holder – rings',
      nameDe: 'Serviettenhalter – Ringe',
      nameRo: 'Suport șervețele – inele',
      slug: 'szalveta-tarto-korok',
      priceHuf: 1890,
      priceEur: 5,
      condition: 'Új',
      category: '3d-konyha',
      image: '/img/3d-szalveta-tarto.png',
      images: ['/img/3d-szalveta-tarto.png'],
      modelUrl: '/models/szalveta-tarto-korok.glb',
      stock: 10,
      isColorable: true,
      description: '3D nyomtatott szalvétatartó, fa stílusú körök (PLA). Ellenőrzött, saját tervezés. Asztalra, konyhába.',
      type: 'stock',
      active: true,
      isNew: true,
    },
    {
      id: '3d-3',
      name: 'Kábel rendező klipsz',
      nameEn: 'Cable organizer clip',
      nameDe: 'Kabel-Organizer-Klammer',
      nameRo: 'Cleme organizator cabluri',
      slug: 'kabel-rendezo-klipsz',
      priceHuf: 1290,
      priceEur: 4,
      discountPriceHuf: 990,
      discountPriceEur: 3,
      condition: 'Új',
      category: '3d-eszkozok',
      image: '/img/3d-szalveta-tarto.png',
      images: ['/img/3d-szalveta-tarto.png'],
      stock: 10,
      isColorable: true,
      onSale: true,
      saleStartAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      saleEndAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      description: '3D nyomtatott kábelrendező klipsz (PLA). Asztal szélére vagy falra rögzíthető. Praktikus, minimalista design.',
      type: 'stock',
      active: true,
    },
    ...([
      { id: '3d-4', slug: 'viragcserep-alatet', name: 'Virágcserép alátét', nameEn: 'Plant pot saucer', category: '3d-kert', priceHuf: 1590, priceEur: 4, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-5', slug: 'fuszertarto-doboz', name: 'Fűszertartó doboz', nameEn: 'Spice storage box', category: '3d-konyha', priceHuf: 2190, priceEur: 6, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-6', slug: 'tolltarto-minimal', name: 'Tolltartó – minimal', nameEn: 'Pen holder – minimal', category: '3d-iroda', priceHuf: 1790, priceEur: 5, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-7', slug: 'konyvjelzo-szett', name: 'Könyvjelző szett', nameEn: 'Bookmark set', category: '3d-dekor', priceHuf: 990, priceEur: 3, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-8', slug: 'ruhafogo-mini', name: 'Ruhafogó mini', nameEn: 'Mini clothes hanger', category: '3d-lakberendezes', priceHuf: 1490, priceEur: 4, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-9', slug: 'fali-fejkosar', name: 'Fali fejkosár', nameEn: 'Wall headband holder', category: '3d-furdoszoba', priceHuf: 1290, priceEur: 4, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-10', slug: 'jatekfigura-allvany', name: 'Játékfigura állvány', nameEn: 'Figurine display stand', category: '3d-hobby', priceHuf: 2490, priceEur: 6, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-11', slug: 'kulcstarto-tarto', name: 'Kulcstartó tartó', nameEn: 'Keychain holder', category: '3d-eloszoba', priceHuf: 1890, priceEur: 5, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-12', slug: 'szappantarto-lekerekített', name: 'Szappantartó – lekerekített', nameEn: 'Soap dish – rounded', category: '3d-furdoszoba', priceHuf: 1690, priceEur: 4, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-13', slug: 'csipteto-tarto', name: 'Csiptető tartó', nameEn: 'Clothespin holder', category: '3d-konyha', priceHuf: 1390, priceEur: 4, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-14', slug: 'parna-tarto-klipsz', name: 'Párna tartó klipsz', nameEn: 'Cushion clip holder', category: '3d-lakberendezes', priceHuf: 1190, priceEur: 3, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-15', slug: 'kabel-cimke-szett', name: 'Kábel címke szett', nameEn: 'Cable label set', category: '3d-eszkozok', priceHuf: 890, priceEur: 3, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-16', slug: 'asztali-papir-tarto', name: 'Asztali papír tartó', nameEn: 'Desk paper tray', category: '3d-iroda', priceHuf: 2790, priceEur: 7, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-17', slug: 'mini-viragvaza', name: 'Mini virágváza', nameEn: 'Mini flower vase', category: '3d-dekor', priceHuf: 1990, priceEur: 5, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-18', slug: 'ajandek-szalag-csevelo', name: 'Ajándék szalag csévélő', nameEn: 'Gift ribbon spool holder', category: '3d-hobby', priceHuf: 2290, priceEur: 6, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-19', slug: 'telefontarto-allvany', name: 'Telefontartó állvány', nameEn: 'Phone stand', category: '3d-iroda', priceHuf: 1590, priceEur: 4, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-20', slug: 'fulhallgato-tarto', name: 'Fülhallgató tartó', nameEn: 'Headphone holder', category: '3d-iroda', priceHuf: 2890, priceEur: 7, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-21', slug: 'poharalatet-szett', name: 'Poháralátét szett (4 db)', nameEn: 'Coaster set (4 pcs)', category: '3d-konyha', priceHuf: 1990, priceEur: 5, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-22', slug: 'szemuvegtarto-asztali', name: 'Szemüvegtartó – asztali', nameEn: 'Desktop glasses holder', category: '3d-iroda', priceHuf: 1490, priceEur: 4, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-23', slug: 'jatekkartya-tarto', name: 'Játékkártya tartó', nameEn: 'Playing card holder', category: '3d-hobby', priceHuf: 1290, priceEur: 4, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-24', slug: 'monitor-emelo', name: 'Monitor emelő', nameEn: 'Monitor riser', category: '3d-iroda', priceHuf: 3490, priceEur: 9, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-25', slug: 'furdoszobai-szappanado', name: 'Fürdőszobai szappanadó', nameEn: 'Bathroom soap saver', category: '3d-furdoszoba', priceHuf: 1090, priceEur: 3, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-26', slug: 'evokanal-tarto', name: 'Evőkanál tartó', nameEn: 'Spoon rest', category: '3d-konyha', priceHuf: 890, priceEur: 3, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-27', slug: 'fali-kapcsolo-vedo', name: 'Fali kapcsoló védő', nameEn: 'Wall switch guard', category: '3d-lakberendezes', priceHuf: 1190, priceEur: 3, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-28', slug: 'usb-kabel-tarto', name: 'USB kábel tartó', nameEn: 'USB cable holder', category: '3d-eszkozok', priceHuf: 990, priceEur: 3, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-29', slug: 'teljes-aru-termek-1', name: 'Teljes árú termék 1', nameEn: 'Full price product 1', category: '3d-konyha', priceHuf: 2990, priceEur: 8, image: '/img/demo/demo-taskav-teal.png' },
      { id: '3d-30', slug: 'teljes-aru-termek-2', name: 'Teljes árú termék 2', nameEn: 'Full price product 2', category: '3d-iroda', priceHuf: 3490, priceEur: 9, image: '/img/demo/demo-taskav-piros.png' },
      { id: '3d-31', slug: 'teljes-aru-termek-3', name: 'Teljes árú termék 3', nameEn: 'Full price product 3', category: '3d-kert', priceHuf: 3990, priceEur: 10, image: '/img/3d-noveny-kotozo.png' },
      { id: '3d-32', slug: 'teljes-aru-termek-4', name: 'Teljes árú termék 4', nameEn: 'Full price product 4', category: '3d-dekor', priceHuf: 4490, priceEur: 11, image: '/img/3d-szalveta-tarto.png' },
      { id: '3d-33', slug: 'teljes-aru-termek-5', name: 'Teljes árú termék 5', nameEn: 'Full price product 5', category: '3d-hobby', priceHuf: 4990, priceEur: 13, image: '/img/demo/demo-taskav-teal.png' },
    ] as const).map((p) => ({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      slug: p.slug,
      priceHuf: p.priceHuf,
      priceEur: p.priceEur,
      condition: 'Új' as const,
      category: p.category,
      image: p.image,
      images: [p.image],
      stock: 20,
      isColorable: true,
      description: `3D nyomtatott teszttermék (PLA) – ${p.name}. Pontgyűjtés teszteléshez.`,
      type: 'stock' as const,
      active: true,
      isNew: true,
    })),
  ]
}

/** Termék slug alapján. Készlet/kijelzés: mindig a canonical listából (getStockById / product.stock a visszaadott másolaton). A kosár nem módosíthatja a készletet. */
export function getProductBySlug(slug: string): Product | undefined {
  const candidates = productSlugLookupCandidates(slug)
  const p = mockProducts.find((x) => candidates.includes(x.slug))
  return p ? { ...p } : undefined
}

/** Termék id alapján. Készletes terméknél maxQty = getStockById(id). A kosár csak productId + qty tárol, soha Product referenciát. */
export function getProductById(id: string): Product | undefined {
  const p = mockProducts.find((x) => x.id === id)
  return p ? { ...p } : undefined
}

export function getProductsByCategory(category: string): Product[] {
  return mockProducts.filter((p) => p.category === category)
}

export function getNewProducts(): Product[] {
  return mockProducts.filter((p) => p.isNew).slice(0, 6)
}

export function getDealProducts(): Product[] {
  return mockProducts.filter((p) => p.onSale).slice(0, 6)
}

/** Beszerzésre rendelhető lista – ugyanabból a canonical mockProducts-ból, mint getProductBySlug/getProductById (egyértelmű státusz listán és termékoldalon). */
export function getSourcingDealProducts(): Product[] {
  return mockProducts.filter((p) => p.type === 'sourcing_deal')
}

/**
 * Legkorábbi lejárati idő a beszerzésre rendelhető ajánlatok közül (jelenleg „sale” státuszúak).
 * A nav countdown FOMO-hoz: ehhez képest számol vissza a menü.
 */
export function getEarliestSourcingExpiry(products: Product[], now: Date = new Date()): Date | null {
  const t = now.getTime()
  let earliest: number | null = null
  for (const p of products) {
    if (p.type !== 'sourcing_deal' || !p.saleTo) continue
    const status = getSourcingDealStatus(p, now)
    if (status !== 'sale') continue
    const saleTo = new Date(p.saleTo).getTime()
    if (saleTo <= t) continue
    if (earliest == null || saleTo < earliest) earliest = saleTo
  }
  return earliest != null ? new Date(earliest) : null
}

// --- Async storefront: DB-first; mockProducts csak dev + nincs DATABASE_URL. ---

async function loadFromDbOrMock<T>(
  loadDb: () => Promise<T>,
  loadMock: () => T,
  empty: T
): Promise<T> {
  const { isDbConfigured, shouldUseMockProductsFallback } = await import('@/lib/prisma')
  if (isDbConfigured()) {
    try {
      return await loadDb()
    } catch {
      // DB hiba: prod-ban vagy DB URL mellett ne essünk mock-ra
    }
  }
  if (shouldUseMockProductsFallback()) {
    return loadMock()
  }
  return empty
}

/** Async: összes termék (DB-first), storefront szűréssel. */
export async function getAllProductsAsync(): Promise<Product[]> {
  const { filterStorefrontProducts } = await import('@/lib/storefront-config')
  const { shouldUseMockProductsFallback } = await import('@/lib/prisma')
  const raw = await loadFromDbOrMock(
    async () => {
      const { getAllProductsFromDb } = await import('@/lib/products')
      return getAllProductsFromDb()
    },
    () => mockProducts,
    [] as Product[]
  )
  return filterStorefrontProducts(raw, shouldUseMockProductsFallback())
}

/** Async: termék slug alapján (DB-first). */
export async function getProductBySlugAsync(slug: string): Promise<Product | undefined> {
  const result = await loadFromDbOrMock(
    async () => {
      const { getProductBySlugFromDb } = await import('@/lib/products')
      return (await getProductBySlugFromDb(slug)) ?? undefined
    },
    () => getProductBySlug(slug),
    undefined as Product | undefined
  )
  return result
}

/** Async: termék id alapján (DB-first). */
export async function getProductByIdAsync(id: string): Promise<Product | undefined> {
  const result = await loadFromDbOrMock(
    async () => {
      const { getProductByIdFromDb } = await import('@/lib/products')
      return (await getProductByIdFromDb(id)) ?? undefined
    },
    () => getProductById(id),
    undefined as Product | undefined
  )
  return result
}

/** Async: beszerzésre rendelhető termékek – kikapcsolva. */
export async function getSourcingDealProductsAsync(): Promise<Product[]> {
  return []
}

/** Async: hasonló termékek (DB-first). */
export async function getSimilarProductsAsync(product: Product, limit = 4): Promise<Product[]> {
  return loadFromDbOrMock(
    async () => {
      const { getSimilarProductsFromDb } = await import('@/lib/products')
      return getSimilarProductsFromDb(product.category, product.id, limit)
    },
    () =>
      mockProducts
        .filter(
          (p) =>
            p.category === product.category && p.id !== product.id && p.type !== 'sourcing_deal'
        )
        .slice(0, limit),
    [] as Product[]
  )
}
