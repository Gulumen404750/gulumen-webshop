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
  /** 3D termék: GLB modell URL (pl. /models/noveny-kotozo.glb), körbe forgatható megjelenítéshez. */
  modelUrl?: string
  stock: number
  variants?: { size?: string; color?: string }[]
  description: string
  isNew?: boolean
  onSale?: boolean
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
  switch (locale) {
    case 'hu':
      return product.name
    case 'en':
      return product.nameEn ?? product.name
    case 'de':
      return product.nameDe ?? product.nameEn ?? product.name
    case 'ro':
      return product.nameRo ?? product.nameEn ?? product.name
    default:
      return product.nameEn ?? product.name
  }
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
  const stock = getStockById(product.id)
  if (stock <= 0) return { canAdd: false, reasonKey: 'status.soldOut' }
  return { canAdd: true }
}

/**
 * Készlet kizárólag a canonical mockProducts-ból. A kosár NEM foglal készletet.
 *
 * Szabályok (Hibaelhárítási útmutató):
 * - Displayed Stock (kijelzett készlet): mindig getStockById(id) – a teljes stock, soha ne vonjuk le a kosár mennyiségét.
 * - Cart Quantity (kosárban lévő): külön, pl. "Kosárban: X db".
 * - Max in cart (max. kosárban): getMaxQty(product) = getStockById(id) készletes terméknél; validáció: cartQty + addQty <= getMaxQty.
 */
/** 3D nyomtatott termékeknél nincs készletlimit – ennyi db-ig lehet egyszerre választani (gyakorlatilag bármennyit). */
const UNLIMITED_STOCK_CAP = 999

export function getStockById(productId: string): number {
  const p = mockProducts.find((x) => x.id === productId)
  if (!p) return 0
  if (is3DProduct(p)) return UNLIMITED_STOCK_CAP
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
  return getStockById(product.id)
}

export const categories = [
  { slug: 'taskak', name: 'Táskák', nameEn: 'Bags', nameDe: 'Taschen', nameRo: 'Genți' },
  { slug: 'ruhazat', name: 'Ruházat', nameEn: 'Clothing', nameDe: 'Kleidung', nameRo: 'Îmbrăcăminte' },
  { slug: 'kiegeszitok', name: 'Kiegészítők', nameEn: 'Accessories', nameDe: 'Accessoires', nameRo: 'Accesorii' },
  { slug: 'elektronika', name: 'Elektronika / Egyéb', nameEn: 'Electronics & More', nameDe: 'Elektronik & Mehr', nameRo: 'Electronică și altele' },
  { slug: 'otthon', name: 'Otthon', nameEn: 'Home', nameDe: 'Zuhause', nameRo: 'Casă' },
  { slug: '3d-nyomtatott', name: '3D Nyomtatott Termékek', nameEn: '3D Printed Products', nameDe: '3D-Druck Produkte', nameRo: 'Produse printate 3D' },
] as const

/** 3D nyomtatott alkategóriák (fülek) – slug = product.category érték. */
export const threeDSubcategories = [
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
  ...getSourcingDealMockProducts(),
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
    },
  ]
}

/** Termék slug alapján. Készlet/kijelzés: mindig a canonical listából (getStockById / product.stock a visszaadott másolaton). A kosár nem módosíthatja a készletet. */
export function getProductBySlug(slug: string): Product | undefined {
  const p = mockProducts.find((x) => x.slug === slug)
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

// --- Async: DB-ből jönnek a termékek, ha konfigurált; különben mock (sync) fallback. ---
async function getProductsSource(): Promise<Product[]> {
  const { isDbConfigured } = await import('@/lib/prisma')
  const { getAllProductsFromDb } = await import('@/lib/products')
  if (isDbConfigured()) return getAllProductsFromDb()
  return mockProducts
}

/** Async: termék slug alapján (DB vagy mock). */
export async function getProductBySlugAsync(slug: string): Promise<Product | undefined> {
  const { isDbConfigured } = await import('@/lib/prisma')
  const { getProductBySlugFromDb } = await import('@/lib/products')
  if (isDbConfigured()) {
    const p = await getProductBySlugFromDb(slug)
    return p ?? undefined
  }
  return getProductBySlug(slug)
}

/** Async: termék id alapján (DB vagy mock). */
export async function getProductByIdAsync(id: string): Promise<Product | undefined> {
  const { isDbConfigured } = await import('@/lib/prisma')
  const { getProductByIdFromDb } = await import('@/lib/products')
  if (isDbConfigured()) {
    const p = await getProductByIdFromDb(id)
    return p ?? undefined
  }
  return getProductById(id)
}

/** Async: összes termék (DB vagy mock). */
export async function getAllProductsAsync(): Promise<Product[]> {
  return getProductsSource()
}

/** Async: beszerzésre rendelhető termékek (DB vagy mock). */
export async function getSourcingDealProductsAsync(): Promise<Product[]> {
  const { isDbConfigured } = await import('@/lib/prisma')
  const { getSourcingDealProductsFromDb } = await import('@/lib/products')
  if (isDbConfigured()) return getSourcingDealProductsFromDb()
  return getSourcingDealProducts()
}
