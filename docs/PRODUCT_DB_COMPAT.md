# Product DB modell vs data.ts – kompatibilitás

## Összefoglaló

- **Stripe checkout és rendelés logika**: kompatibilis az új Product (Prisma) modelllel, ha a termékeket a `getProductByIdAsync` / `getProductBySlugAsync` és a `@/lib/products` `dbProductToProduct` mapelésén keresztül használod. A checkout/Stripe csak a közös `Product` típusra (data.ts interface) támaszkodik; a DB-s termékek ezt a formátumot kapják a `products.ts`-ben.
- **Egy javítás készült**: a Stripe `create-checkout-session` most már a tényleges `getProductOrdersCount(productId)` értéket használja a sourcing deal státuszhoz (korábban a DB-s terméknél mindig 0 volt az ordersCount, így az elkelt ajánlat is átment volna).

## Amit a checkout/rendelés használ a Product-ból

- `id`, `name`, `priceHuf`, `discountPriceHuf`, `type` (`'stock' | 'sourcing_deal'`)
- Sourcing esetén: `maxOrders` (foglalás: `reserveSourcingSlots`), időzítéshez: `saleFrom` / `saleTo` (DB: `dealStartAt` / `dealEndAt`), `previewFrom`
- A rendelt mennyiség (sourcing limit) **nem** a `product.ordersCount`-ból jön, hanem a `getProductOrdersCount(productId)` hívából (orders/OrderItem aggregáció). A `products.ts` mapelés nem állítja be az `ordersCount`-ot; ez szándékos.

## Prisma Product → data.ts Product mapelés (products.ts)

- `dealStartAt` → `saleFrom`, `dealEndAt` → `saleTo`, `previewFrom` → `previewFrom`
- `type`, `maxOrders`, `priceHuf`, `discountPriceHuf`, `name`, többi mező egy az egyben vagy opcionálissá alakítva. A checkout/Stripe ezzel kompatibilis.

## Hol maradt a régi data.ts / mock struktúra szükségesnek (vagy hibás DB mellett)

Ezek a helyek **szinkron** `getProductById` / `getProductBySlug` / `getStockById` / `mockProducts` használat miatt **csak a mock listát** látják. Ha a termékek már az adatbázisból jönnek (DATABASE_URL beállítva), itt DB-s termékre undefined/0 lehet az eredmény:

| Hely | Probléma |
|------|----------|
| `getStockById(productId)` (data.ts) | Csak `mockProducts`-ot nézi → DB-s termékre mindig **0** a készlet. Érinti: kosár limit, „Eladva” gomb, max mennyiség. |
| `getMaxQty(product)` | `getStockById(product.id)`-t hívja → DB-s terméknél 0. |
| **Komponensek** | |
| `src/app/api/products/[id]/like/route.ts` | `getProductById` (sync) → DB-s termékre undefined. |
| `src/app/fizetes/page.tsx` | `getProductById(item.productId)` → kosár DB-s termékekkel üres/undefined. |
| `src/components/RecentlyViewed.tsx` | `getProductById(id)` (sync) → DB-s id-kra undefined. |
| `src/app/kedvencek/page.tsx` | `getProductById(id)` (sync) → DB-s kedvencek nem jelennek meg. |
| `src/components/CartDrawer.tsx` | `getProductById(item.productId)` → DB-s kosárnál termékek hiányoznak. |
| `src/app/kosar/page.tsx` | `getProductById`, `getStockById`, `getMaxQty` → készlet és max mennyiség DB-nél 0. |
| `src/context/CartContext.tsx` | `getProductById`, `getStockById` → ugyanaz. |
| `src/components/ProductCard.tsx` | `getStockById(product.id)` → készlet DB-nél 0. |
| `src/app/termek/[slug]/ProductPageContent.tsx` | `getProductBySlug`, `getStockById`, `mockProducts` (hasonló termékek) → sync források, DB-nél hibás. |
| **Lapok, csak mock** | |
| `src/app/ujdonsagok/page.tsx` | Közvetlenül `mockProducts` → DB-nél üres újdonság lista. |
| `src/app/akciok/page.tsx` | Közvetlenül `mockProducts` → DB-nél üres akciós lista. |
| `src/app/page.tsx` | `getNewProducts()`, `getDealProducts()` → mock listából → DB-nél üres blokkok. |
| `src/components/ShopContent.tsx` | `mockProducts`, default stock list → DB-nél alapértelmezett mock listát használ, ha nincs szerverről adat. |
| `src/components/DealPopup.tsx` | `getDealProducts()` → mock. |

## Ajánlott lépések (DB használata mellett)

1. **Készlet**: Vagy a `getProductByIdAsync`-ból kapott `product.stock` használata (már benne van a mapelt Product-ban), vagy egy külön `getStockByIdAsync(productId)` ami DB esetén a Product.stock-ot adja, mock esetén a jelenlegi `getStockById`-t.
2. **getMaxQty**: DB pathon használjon async termékbetöltést + `product.stock` / sourcing `maxOrders - getProductOrdersCount(productId)`.
3. **Like / kedvencek / kosár / fizetés oldal**: Ezeken a termékeket `getProductByIdAsync` (vagy szerverről kapott adat) alapján kell megjeleníteni, ne sync `getProductById`-tal.
4. **Újdonságok / Akciók / Főoldal**: Async listák: pl. `getNewProductsAsync()` / `getDealProductsAsync()` a `products.ts`-ben (DB: `where: { isNew: true }` / `where: { onSale: true }`), és ezek használata ezeken a lapokon.
5. **ProductPageContent**: Slug alapján `getProductBySlugAsync` (layout már async-et használhat), készlet = `product.stock` vagy async stock; hasonló termékek: pl. `getProductsByCategoryFromDb(product.category)` vagy dedikált endpoint.

Ha ezeket átvezeted, a régi data.ts termék struktúra csak a **mock fallback** (nincs DATABASE_URL) és a **típusdefiníció** (Product interface) szerepét fogja betölteni; a Stripe checkout és rendelés logika teljesen kompatibilis marad az új Product adatbázis modelllel.
