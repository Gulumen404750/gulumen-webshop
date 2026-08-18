/** Gamification konfiguráció – később Setting táblából is olvasható. */

/** Europe/Budapest naptári nap (éjfél nullázás). */
export const GAMIFICATION_TIMEZONE = 'Europe/Budapest'

/** Napi aktív böngészés cél másodpercben (5 perc) – egy bónusz session. */
export const BROWSE_DAILY_TARGET_SECONDS = 300

/** Napi max. böngészés bónusz (5 perc = 10 pont) – naponta ennyiszer. */
export const BROWSE_DAILY_MAX_BONUSES = 2

/** Két böngészés bónusz között minimum ennyi idő (12 óra). */
export const BROWSE_BONUS_COOLDOWN_MS = 12 * 60 * 60 * 1000

/** Napi kedvencelés cél. */
export const DAILY_LIKE_TARGET = 10

/** Unlike után visszavonjuk a napi számlálót (ha bónusz még nem járt). */
export const LIKE_UNDO_DECREMENTS_DAILY_COUNT = true

/** Pont jóváírás: 5 perc aktív böngészés. */
export const POINTS_BROWSE_5MIN = 10

/** Pont jóváírás: napi 10 kedvenc (12 órás ablak). */
export const POINTS_DAILY_LIKE_BONUS = 25

/** 1 pont = 1 Ft. */
export const POINTS_PER_HUF = 1

/** Kosár max. ennyi %-a fizethető sima (böngészés/lájk) ponttal. */
export const MAX_CART_POINTS_COVERAGE = 0.3

/** NFC / ajándékpontok a termékár 100%-ára levásárolhatók. */
export const GIFT_POINTS_MAX_COVERAGE = 1

/** NFC ajándékpont érvényesség aktiválástól (nap). */
export const GIFT_POINT_VALIDITY_DAYS = 30

/** Lájk pontszerzés: 12 órás gördülő ablak. */
export const LIKE_BONUS_WINDOW_MS = 12 * 60 * 60 * 1000

/** Kupon beváltás küszöb (350–400 között konfigurálható). */
export const REDEEM_THRESHOLD_MIN = 350
export const REDEEM_THRESHOLD_MAX = 400
export const REDEEM_THRESHOLD_DEFAULT = 375

/** Kupon lejárat beváltás után (nap). */
export const COUPON_VALIDITY_DAYS = 30

/** Kupon kedvezmény % (egyedi gamification kupon). */
export const REDEEM_COUPON_PERCENT = 10

/** Egy heartbeat tick = 1 perc aktív idő (szerver számol, kliens nem küld delta-t). */
export const HEARTBEAT_TICK_SECONDS = 60

/** Heartbeat max másodperc / kérés (legacy delta clamp). */
export const HEARTBEAT_MAX_DELTA_SECONDS = 90

/** Minimum idő két tick között (ms) – max ~3 tick/perc szerveroldalon. */
export const HEARTBEAT_MIN_INTERVAL_MS = 20_000

/** Heartbeat minimum interval kliens oldalon (ms) – percenkénti tick. */
export const HEARTBEAT_CLIENT_INTERVAL_MS = 60_000

/** Max heartbeat tick / perc (user + IP velocity). */
export const HEARTBEAT_VELOCITY_MAX_PER_MINUTE = 3

/** Outbox worker batch méret. */
export const POINT_EVENT_BATCH_SIZE = 50

/** Optimistic lock retry. */
export const WALLET_UPDATE_MAX_RETRIES = 5

/** Szerencsekerék: teljes csomag (max. tier) darabszám. */
export const LUCKY_SPIN_MIN_ITEMS = 10

/** Szerencsekerék kedvezményszintek (0–1). */
export const LUCKY_SPIN_DISCOUNT_TIER_LOW = 0.15
export const LUCKY_SPIN_DISCOUNT_TIER_MID = 0.2
export const LUCKY_SPIN_DISCOUNT_TIER_HIGH = 0.25

/** Ponttal fizetés extra kedvezmény a Szerencsekerék szinten (halmozva). */
export const LUCKY_SPIN_POINTS_EXTRA_PERCENT = 0.05

/** @deprecated Használd calculateLuckySpinDiscountPercent-et a tényleges százalékhoz. */
export const LUCKY_SPIN_DISCOUNT_PERCENT = LUCKY_SPIN_DISCOUNT_TIER_HIGH

/** Szerencsekerék érvényesség (nap). */
export const LUCKY_SPIN_VALIDITY_DAYS = 3

/** Szerencsekerék: ennyi termék kerül kiválasztásra. */
export const LUCKY_SPIN_PRODUCT_COUNT = 10

/** @deprecated A +5% most checkout kedvezményként érvényesül (LUCKY_SPIN_POINTS_EXTRA_PERCENT). */
export const LUCKY_SPIN_POINTS_BONUS_PERCENT = LUCKY_SPIN_POINTS_EXTRA_PERCENT

/** Minimum nap két pörgetés között. */
export const LUCKY_SPIN_COOLDOWN_DAYS = 7

/** Szerencsekerék: minimum kedvelt termék szám a pörgetéshez. */
export const LUCKY_SPIN_MIN_LIKES = 20

/** Ingyenes szállítás küszöb (Ft) – kedvezmények UTÁN. Pontfizetésnél a szállítás mindig fizetendő. */
export const FREE_SHIPPING_THRESHOLD = 25_000

/** Standard szállítási díj (Ft), ha a végső összeg a küszöb alatt marad. */
export const STANDARD_SHIPPING_FEE_HUF = 1_990

export const POINT_TX_TYPES = {
  BROWSE_5MIN: 'BROWSE_5MIN',
  LIKE_DAILY_BONUS: 'LIKE_DAILY_BONUS',
  REDEEM_COUPON: 'REDEEM_COUPON',
  PURCHASE_REDEEM: 'PURCHASE_REDEEM',
  LUCKY_SPIN_BONUS: 'LUCKY_SPIN_BONUS',
  REVERSAL: 'REVERSAL',
  ADMIN_ADJUST: 'ADMIN_ADJUST',
  NFC_GIFT: 'NFC_GIFT',
} as const

export type PointTxType = (typeof POINT_TX_TYPES)[keyof typeof POINT_TX_TYPES]
