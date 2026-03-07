# Gulumen Admin rendszer – megvalósítási terv

## Összefoglaló – Kész elemek

### Új / módosított fájlok

**Prisma**
- `prisma/schema.prisma` – Product, Coupon, Setting modellek
- `prisma/migrations/20260307120000_add_product_coupon_setting/migration.sql` – migráció

**Lib**
- `src/lib/products.ts` – termékek betöltése DB-ből (getAllProductsFromDb, getProductBySlugFromDb, getProductByIdFromDb, getSourcingDealProductsFromDb)
- `src/lib/data.ts` – getProductBySlugAsync, getProductByIdAsync, getAllProductsAsync, getSourcingDealProductsAsync (DB vagy mock)
- `src/lib/admin-auth.ts` – requireAdmin() cookie ellenőrzés

**Admin UI**
- `src/app/admin/layout.tsx` – sidebar menü (Áttekintés, Termékek, Rendelések, …), kijelentkezés
- `src/app/admin/dashboard/page.tsx` – Áttekintés (kártyák)
- `src/app/admin/dashboard/products/page.tsx` – termék lista, keresés, szűrés
- `src/app/admin/dashboard/products/[id]/page.tsx` – termék szerkesztés / új (slug, név i18n, ár, készlet, kép, 3D, sourcing mezők)
- `src/app/admin/dashboard/orders/page.tsx` – rendelés lista, státusz szűrés
- `src/app/admin/dashboard/orders/[id]/page.tsx` – rendelés részletek + Sourcing sikeres / sikertelen gombok
- `src/app/admin/dashboard/orders/[id]/AdminOrderDetailActions.tsx` – sourcing success/fail gombok
- `src/app/admin/dashboard/coupons/page.tsx` – placeholder
- `src/app/admin/dashboard/users/page.tsx` – felhasználó lista (email, regisztráció, rendelésszám)
- `src/app/admin/dashboard/chat/page.tsx` – placeholder
- `src/app/admin/dashboard/settings/page.tsx` – env állapotok (titkok nem nyersen)
- `src/app/admin/dashboard/calls/` – meglévő hívások + callback kérések (változatlan, integrálva a menübe)

**Admin API**
- `src/app/api/admin/products/route.ts` – GET lista, POST új
- `src/app/api/admin/products/[id]/route.ts` – GET, PATCH, DELETE
- `src/app/api/admin/orders/route.ts` – GET lista
- Sourcing success/fail – cookie auth is elfogadva (mellettük x-admin-key)

**Vásárlói oldal (DB vagy mock)**
- `src/app/termek/[slug]/page.tsx` – getProductBySlugAsync
- `src/app/termek/[slug]/layout.tsx` – getProductBySlugAsync metadata-hoz
- `src/app/beszerzesre-rendelheto/page.tsx` – getSourcingDealProductsAsync
- `src/app/lejart-termekek/page.tsx` – getSourcingDealProductsAsync
- `src/app/termekek/page.tsx` – getAllProductsAsync, ShopContent initialProducts
- `src/components/ShopContent.tsx` – initialProducts prop (szerverről jövő termékek)
- `src/app/api/checkout/route.ts` – getProductByIdAsync, productMap
- `src/app/api/stripe/create-checkout-session/route.ts` – getProductByIdAsync, productMap
- `src/app/api/products/[id]/orders-count/route.ts` – getProductByIdAsync
- `src/app/sitemap.ts` – getAllProductsAsync

**Egyéb**
- `scripts/seed-products.ts` – 2 stock + 1 sourcing példa termék seed
- `package.json` – "seed:products": "npx tsx scripts/seed-products.ts"

### Migráció és seed

1. **Migráció futtatása** (ha még nem futott):
   ```bash
   npx prisma migrate deploy
   ```
   vagy dev környezetben:
   ```bash
   npx prisma migrate dev
   ```

2. **Termékek seedelése** (opcionális, példa adatok):
   ```bash
   npm run seed:products
   ```
   Ez 2 készletterméket és 1 beszerzéses deal-t hoz létre. A sourcing deal fix dealStartAt/dealEndAt-tal jön létre (seed időpont + 12–15 nap), így deploy után nem resetelődik.

### Admin használat

1. Bejelentkezés: `/admin/login` – ADMIN_API_KEY megadása (cookie 24 órára).
2. Áttekintés: `/admin/dashboard` – kártyák (termékek, rendelések, callback, hívások, felhasználók).
3. Termékek: lista, keresés, szűrés típus szerint; „Új termék” → űrlap; „Szerkesztés” → ugyanaz az űrlap (név hu/en/de/ro, ár, akciós ár, készlet, kép, 3D modelUrl, beszerzéses deal: indulás/vége, maxOrders).
4. Rendelések: lista, státusz szűrés; „Részletek” → rendelés adatok + sourcing rendelésnél „Sourcing sikeres” / „Sourcing sikertelen” gombok.
5. Hívások: a meglévő calls dashboard (mai hívások, callback pending, címkék).
6. Beállítások: env állapotok (DB, Stripe, Admin kulcs, App URL) – titkok nem látszanak.

### Fontos megjegyzések

- **Termékek forrása**: Ha a DATABASE_URL be van állítva és a Product tábla létezik, a termékek (lista, termékoldal, beszerzésre rendelhető, lejárt, sitemap, checkout) az adatbázisból jönnek. Ha nincs DB vagy üres a Product tábla, a régi mockProducts továbbra is használatos (fallback).
- **Sourcing időzítés**: A visszaszámlálós deal-ek dealStartAt, dealEndAt, previewFrom, maxOrders mezői az adatbázisban vannak. A ordersCount a rendelésekből aggregálódik (getProductOrdersCount). Deploy/restart után a countdown nem indul újra.
- **Meglévő route-ok**: Vásárlói oldalak, Stripe, auth, slug-ok változatlanok; csak a termékadat forrása váltott (DB vs mock).

---

## 1. Jelenlegi állapot (rövid)

- **Termékek**: `src/lib/data.ts` – `mockProducts` tömb, kódalapú. Sourcing deal időzítés `getSeedNow()`-ból (deploy után újraindul).
- **Rendelések**: Prisma `Order` + `OrderItem`, `getProductOrdersCount()` DB aggregáció.
- **Admin**: `ADMIN_API_KEY` → cookie, `/admin/login`, `/admin/dashboard/calls` (hívások + callback kérések). Sourcing success/fail: `x-admin-key` header.
- **Prisma**: Nincs `Product` modell. Van: User, Order, OrderItem, PaymentTransaction, ProductLike, LoyaltyRecord, AdminAction, ProductReservation, Call, CallbackRequest, stb.
- **Kupon**: Nincs külön modell; checkout loyalty / body discount.
- **Chat**: `/api/chat`, rule-based + fallback; nincs admin felület.

## 2. Cél

- Termékek adatbázisból, admin UI-ból kezelhetők.
- Sourcing időzítés (dealStartAt, dealEndAt, maxOrders, ordersCount) csak DB-ből, deploy után ne resetelődjön.
- Teljes admin dashboard: Áttekintés, Termékek, Rendelések, Kuponok, Felhasználók, Chat, Hívások, Beállítások.
- Meglévő vásárlói oldal és API-k változatlanul működnek (slug, SEO, Stripe, auth).

## 3. Adatmodell módosítások

### 3.1 Product (új)
- `id` (cuid), `slug` (unique), `name`, `nameEn`, `nameDe`, `nameRo`
- `priceHuf`, `priceEur`, `discountPriceHuf`, `discountPriceEur`
- `condition`, `category`, `image`, `images` (Json/String[]), `images360` (Json, opc.)
- `modelUrl`, `stock`, `variants` (Json, opc.), `description`
- `isNew`, `onSale`, `active` (boolean, default true)
- **Sourcing**: `type` ('stock' | 'sourcing_deal'), `sourcingEnabled` (bool), `dealStartAt`, `dealEndAt`, `previewFrom` (DateTime?), `maxOrders` (Int?), `sourcingStatus` (String? – optional cache)
- `isColorable`, `likesCount` (Int, default 0)
- `createdAt`, `updatedAt`

### 3.2 Coupon (új)
- `id`, `code` (unique), `discountType` ('percent' | 'fixed'), `discountValue` (Int: % 0–100 vagy HUF)
- `active`, `validFrom`, `validUntil`, `minOrderHuf`, `maxUses` (null = unlimited), `usedCount`
- `createdAt`, `updatedAt`

### 3.3 ChatConfig / AdminSettings
- Egyszerű key-value: `Setting` modell: `key` (unique), `value` (String/Json). Keys: `chat_system_prompt`, `chat_ai_enabled`, `chat_fallback_*`, `rate_limit_*`, `shop_name`, `support_email`, stb. Vagy külön táblák – kezdésnek egy `Setting` elég.

### 3.4 AdminUser (opcionális, később)
- Első körben marad a kulcsos belépés.

## 4. Migráció és seed

- Új migráció: Product, Coupon, Setting (ha ezt választjuk).
- Seed script: meglévő mockProducts (stock + 3D) és sourcing deal termékek beszúrása; sourcing-nál fix `dealStartAt` / `dealEndAt` (pl. seed időpont + 8 nap, + 11 nap), hogy ne futó idő legyen.

## 5. Termékek betöltése (vásárlói oldal)

- Új `lib/products.ts`: `getAllProducts()`, `getProductBySlug()`, `getProductById()` – Prisma-ból, Product rekordot Product interface-sé mapoljuk.
- `data.ts`: ha DB konfigurált, exportált függvények a products.ts-t hívják; egyébként marad a mockProducts (fallback).
- Sourcing státusz: `getSourcingDealStatus(product, now, ordersCountOverride)` – product a DB-ból jön, `dealStartAt`/`dealEndAt` mezőkkel; ordersCount továbbra is `getProductOrdersCount(productId)`.

## 6. Admin UI felépítés

- **Layout**: `/admin/layout.tsx` – sötét sidebar (Áttekintés, Termékek, Rendelések, Kuponok, Felhasználók, Chat, Hívások, Beállítások), kijelentkezés.
- **Áttekintés**: kártyák (mai rendelések, termékek száma, függő callback, stb.).
- **Termékek**: táblázat (név, kategória, ár, készlet, aktív, sourcing), keresés/szűrés, pagination; Új termék; Szerkesztés (űrlap: alap + i18n + képek + 3D + sourcing mezők).
- **Rendelések**: táblázat (id, státusz, összeg, email, dátum), szűrés státuszra; Részletek modal vagy oldal; Státusz váltás; Sourcing: Success / Fail gombok.
- **Kuponok**: lista, Új kupon, szerkesztés (code, típus, érték, min order, lejárat, max használat).
- **Felhasználók**: User lista (email, createdAt), rendelésszám, összes költés (aggregált).
- **Chat**: system prompt textarea, AI be/ki, fallback szövegek, rate limit (megjelenítés/szerkesztés).
- **Hívások**: meglévő calls + callback integrálva, ugyanaz a funkció.
- **Beállítások**: webshop név, email, support, szállítás, feature flag-ek; env állapotok (pl. STRIPE konfigurált: igen/nem, titkok nem nyersen).

## 7. Biztonság és kompatibilitás

- Admin route-ok: middleware továbbra is cookie-t ellenőriz; API-k cookie vagy x-admin-key.
- Meglévő route-ok (/api/checkout, /api/stripe/*, /termek/[slug], stb.) nem változnak URL-ben; a termékadat forrása lesz a DB (ha van), különben mock.
- Slug kompatibilitás: seed-nél ugyanazok a slug-ok maradnak; új terméknél adminban slug megadható.

## 8. Fájlváltások (terv)

- **Új**: `prisma/migrations/..._add_product_coupon_settings/migration.sql`
- **Új**: `src/lib/products.ts` (DB termék olvasás/mapolás)
- **Új**: `scripts/seed-products.ts` vagy `seed.ts`
- **Új**: `src/app/admin/layout.tsx`, `dashboard/page.tsx`, `products/page.tsx`, `orders/page.tsx`, stb.
- **Új**: `src/app/api/admin/products/route.ts`, `.../products/[id]/route.ts`, `.../orders/route.ts`, `.../coupons/...`, `.../settings/...`, `.../users/...`, `.../chat-config/...`
- **Módosítandó**: `prisma/schema.prisma`, `src/lib/data.ts` (termék forrás váltás), `src/components/ShopContent.tsx` (termék lista forrás), `src/app/termek/[slug]/page.tsx` (getProductBySlug forrás), beszerzesre-rendelheto, lejart-termekek (ha külön komponensek hívják getSourcingDealProducts)

Ezt a tervet követve készül el a megvalósítás.
