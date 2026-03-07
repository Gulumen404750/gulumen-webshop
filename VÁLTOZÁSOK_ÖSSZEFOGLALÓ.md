# Gulumen B mód – Változások összefoglalója

Stabil alap: adatbázis → auth → biztonság → sourcing logika → monitoring. **Valós Stripe fizetés nincs bekötve**, DummyProvider marad.

---

## Teljes módosított fájllista

### Új fájlok
- `src/middleware.ts`
- `src/lib/idempotency.ts`
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `src/lib/logger.ts`
- `src/lib/admin-audit.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/products/[id]/orders-count/route.ts`
- `prisma/migrations/20260217120000_init/migration.sql`
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

### Módosított fájlok
- `src/app/api/stripe/webhook/route.ts` – lazy init, 501
- `src/app/api/stripe/create-checkout-session/route.ts` – getStripe()
- `src/app/api/checkout/route.ts` – idempotency, logger, getProductOrdersCount, async orders
- `src/app/api/orders/by-session/route.ts` – await getOrderById
- `src/app/api/orders/by-group/route.ts` – await getOrdersByGroupId
- `src/app/api/payments/webhook/route.ts` – await getOrderById, setOrderStatus
- `src/app/api/admin/sourcing/[orderId]/success/route.ts` – await, logger, logAdminAction
- `src/app/api/admin/sourcing/[orderId]/fail/route.ts` – await, logger, logAdminAction
- `src/app/api/me/wishlist/route.ts` – getSession, X-User-Id törölve
- `src/app/api/products/[id]/like/route.ts` – getSession, X-User-Id törölve
- `src/lib/orders.ts` – Prisma + JSON fallback, async API, getProductOrdersCount
- `src/context/AuthContext.tsx` – session API, register/login/logout, nincs localStorage
- `src/context/WishlistContext.tsx` – credentials: 'include', nincs X-User-Id
- `src/components/ProductCard.tsx` – credentials: 'include', nincs X-User-Id
- `src/app/termek/[slug]/page.tsx` – credentials: 'include', nincs X-User-Id
- `src/app/regisztracio/page.tsx` – register API, jelszó validáció
- `src/app/profil/page.tsx` – async login/logout, loginError
- `prisma/schema.prisma` – User, Order, OrderItem, PaymentTransaction, ProductLike, LoyaltyRecord, AdminAction
- `prisma.config.ts` – url fallback ""
- `.env` – DATABASE_URL, JWT_SECRET, Sentry megjegyzések
- `package.json` – @prisma/client, prisma, bcryptjs, jose, pino, pino-pretty, @sentry/nextjs, @types/bcryptjs
- `next.config.js` – withSentryConfig (ha SENTRY_DSN)

---

## P0 – STABIL ALAP

### 1) Stripe webhook build fix
- **Fájl:** `src/app/api/stripe/webhook/route.ts`
- **Változás:** A modul szintű `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)` és `webhookSecret` eltávolítva. Új `getStripe()` függvény: csak akkor ad vissza Stripe-ot és webhook secretet, ha mindkét env megvan; különben `null`. A POST handler elején: ha `getStripe()` null → **501** válasz ("Stripe not configured"), így hiányzó STRIPE_SECRET_KEY nem törli a buildet. A webhook logika csak a handlerben használja a lazy-initialized Stripe-ot.
- **create-checkout-session:** Szintén `getStripe()` használata, 501 ha nincs konfig.

### 2) Security middleware
- **Új fájl:** `src/middleware.ts`
- **Tartalom:** NextResponse.next() után header-ek: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `Content-Security-Policy: default-src 'self'; ...`. Matcher: minden route kivéve _next/static, _next/image, favicon.

### 3) Checkout idempotencia
- **Új fájl:** `src/lib/idempotency.ts` – in-memory Map, TTL 24h, `getIdempotencyKey(request)`, `getIdempotentResponse(key)`, `setIdempotentResponse(key, body, status, headers)`.
- **Fájl:** `src/app/api/checkout/route.ts` – POST elején: ha van `Idempotency-Key` header, ellenőrzi a cache-t; ha van korábbi válasz, azt adja vissza. Sikeres válasz végén: ha volt idempotency key, cache-eli a választ.

---

## P1 – ADATBÁZIS

### 4) Prisma init
- `prisma/schema.prisma` már létezett; datasource `url = env("DATABASE_URL")`.
- `.env`: `DATABASE_URL=` (és opcionális komment) hozzáadva.
- `package.json`: `@prisma/client`, `prisma` (dev) dependency.

### 5) schema.prisma első verzió
- **Modellek:** User (id, email unique, passwordHash, name), Order (id, status, orderGroupId, orderType, subtotalHuf, discountHuf, totalHuf, currency, createdAt, customerEmail, stripeSessionId, paymentIntentId, amountPaid, currencyPaid, paidAt, paidWebhookEventId, countedForLoyalty, refundedAmount, refundStatus, cancelRequestedAt, userId → User), OrderItem (orderId → Order, productId, qty, fulfillmentType, priceHuf, name), PaymentTransaction (orderId → Order, provider, mode, status, amount, currency, providerRef), ProductLike (productId, userId → User, @@unique([productId, userId])), LoyaltyRecord (userId optional → User, email unique, qualifyingPaidOrdersCount, loyaltyPercent, lastUpdatedAt), AdminAction (action, orderId, success, details, createdAt).
- generator: `prisma-client-js` (alapértelmezett kimenet).

### 6) Migráció
- **Új:** `prisma/migrations/20260217120000_init/migration.sql` – teljes SQL a fenti táblákhoz (CreateTable, CreateIndex, AddForeignKey). Futtatás: `npx prisma migrate deploy` (ha van DATABASE_URL).

### 7) Orders migrálása JSON-ból DB-be
- **Új:** `src/lib/prisma.ts` – PrismaClient singleton, `isDbConfigured()` (DATABASE_URL létezik és nem üres).
- **Fájl:** `src/lib/orders.ts` – Minden művelet: ha `isDbConfigured()` akkor Prisma (create, findUnique, findFirst, update, aggregate), különben JSON fájl (loadOrders/saveOrders). API **async**: createOrder, getOrderById, setOrderPaid, setOrderFailed, setOrderCountedForLoyalty, getOrderByStripeSessionId, getOrderByPaymentIntentId, createCheckoutOrders, getOrdersByGroupId, setOrderStatus, setOrderCustomerEmail mind Promise. Új export: `getProductOrdersCount(productId)` – DB: OrderItem aggregáció (SUM(qty) ahol order.status IN ('payment_pending','sourcing_pending','fulfilled','paid')); JSON fallback: ugyanez a memóriából.
- Összes hívó (checkout, stripe webhook, by-session, by-group, payments webhook, admin success/fail, create-checkout-session) átírva await-re.

---

## P2 – AUTH

### 8) Auth rendszer
- **localStorage userId megszüntetve.** Session: httpOnly cookie (JWT).
- **Új:** `src/lib/auth.ts` – jose (SignJWT, jwtVerify), cookie név `gulumen-session`, `getSession(request)` → { userId, email } vagy null, `createSession(userId, email)`, `getSessionCookieHeader(token)`, `getClearSessionCookieHeader()`.
- **Új:** `src/app/api/auth/register/route.ts` – POST body: email, password (min 8), name optional. bcrypt hash (12), Prisma User create (email unique), session cookie beállítva, válasz: { user: { id, email, name } }. 409 ha már létezik az email.
- **Új:** `src/app/api/auth/login/route.ts` – POST email, password; User findUnique; bcrypt.compare; session cookie; válasz { user }.
- **Új:** `src/app/api/auth/logout/route.ts` – POST, Set-Cookie törlés.
- **Új:** `src/app/api/auth/session/route.ts` – GET, cookie alapján user vagy 401.
- **AuthContext:** Mountkor GET /api/auth/session (credentials: 'include'), válasz alapján userId (email) beállítva. login(email, password) → POST /api/auth/login, sikeres válasz után setUserId(data.user.email). register(email, password, name?) → POST /api/auth/register. logout() → POST /api/auth/logout majd setUserId(null). Nincs localStorage.
- **Regisztráció oldal:** handleSubmit → register(trimmedEmail, password), jelszó hossz ellenőrzés, hibaüzenet.
- **Profil oldal:** handleLogin → login(email, password), loginError state, logout gomb async logout().

### 9) Wishlist / like
- **X-User-Id header törölve.** User session alapján: getSession(request), session.userId.
- `src/app/api/me/wishlist/route.ts` – getSession(request), ha nincs session → 401; ProductLikes.getLikedProductIdsByUser(session.userId).
- `src/app/api/products/[id]/like/route.ts` – GET: liked = session ? ProductLikes.hasLike(..., session.userId) : false. POST: session kötelező, toggleLike(productId, session.userId).
- Kliens: WishlistContext, ProductCard, termek/[slug] – fetch opciók: credentials: 'include', X-User-Id header nélkül.

---

## P3 – SOURCING

### 10) product.ordersCount valós számítás
- **orders.ts:** `getProductOrdersCount(productId)` – DB: OrderItem összegzés ahol order.status IN ('payment_pending','sourcing_pending','fulfilled','paid'); JSON fallback: ugyanaz.
- **Checkout:** Sourcing deal termékeknél `await getProductOrdersCount(item.productId)`, majd `getTimedPurchaseStatus(product, now, ordersCount)` – soldout logika szerver oldalon.
- **Új:** `src/app/api/products/[id]/orders-count/route.ts` – GET, sourcing_deal termékre { ordersCount, maxOrders } (getProductOrdersCount + data getProductById).

---

## P4 – MONITORING

### 11) Logger (pino)
- **Új:** `src/lib/logger.ts` – pino, dev-ban pino-pretty transport. LOG_LEVEL / NODE_ENV alapján level.
- Stripe webhook, checkout, admin success/fail: console.* helyett logger.error / logger.warn / logger.debug.

### 12) Sentry (opcionális)
- **Új:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` – Sentry.init csak ha DSN be van állítva.
- **next.config.js:** Ha SENTRY_DSN: withSentryConfig(nextConfig, sentryWebpackPluginOptions). .env komment: SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT.

### 13) Admin audit log
- **Prisma:** AdminAction model (action, orderId, success, details, createdAt).
- **Új:** `src/lib/admin-audit.ts` – logAdminAction({ action, orderId?, success, details? }) → prisma.adminAction.create, vagy ha nincs DB: logger.info.
- **admin/sourcing/[orderId]/success:** Sikeres capture után logAdminAction('sourcing_success', orderId, true). Hiba esetén logAdminAction(..., false, result.error).
- **admin/sourcing/[orderId]/fail:** Hasonlóan sourcing_fail, success true/false.

---

## Rövid magyarázat lépésenként

| Lépés | Mit csináltunk | Miért |
|-------|----------------|-------|
| P0-1 | Stripe webhook: lazy init, 501 ha nincs key | Build ne essen el hiányzó STRIPE env miatt. |
| P0-2 | middleware.ts security header-ek | XSS, clickjacking, MIME sniff, HSTS, CSP alap. |
| P0-3 | Idempotency-Key + in-memory cache a checkout-on | Dupla kattintás ne hozzon két rendelést. |
| P1-4,5,6 | Prisma init, schema, migration SQL | Postgres (Supabase/Neon) készenlét. |
| P1-7 | orders.ts Prisma + JSON fallback, async | PROD DB, DEV-ban JSON; egy API. |
| P2-8 | Auth: cookie session, register/login/logout, bcrypt | Biztonságos azonosítás, nincs localStorage. |
| P2-9 | Wishlist/like: getSession(), credentials | Session alapú, X-User-Id kikerülve. |
| P3-10 | getProductOrdersCount, checkout validáció, orders-count API | Sourcing soldout valós DB számítás. |
| P4-11 | pino logger | Strukturált log. |
| P4-12 | Sentry config fájlok, next.config | DSN-nel készenlét. |
| P4-13 | AdminAction + logAdminAction a sourcing végpontokon | Audit: ki, mikor, sikeres/sikertelen. |

---

## Fontos megjegyzések

- **Stripe:** Nincs valós fizetés bekötve; webhook és create-checkout 501 ha nincs key; DummyProvider marad a checkout flow-ban.
- **Build:** A `npm run build` a típusellenőrzésig és a compile-ig rendben lefut. A statikus oldal generálásnál a meglévő **useSearchParams()** használat miatt (pl. LocaleContext) Next.js Suspense boundary figyelmeztetések jelentkeznek; ezt a jelen változtatások nem vezették be.
- **Migráció futtatása:** Ha van éles DATABASE_URL: `npx prisma migrate deploy`. Első alkalommal: táblák a migration.sql alapján jönnek létre.
- **Auth:** Ha nincs DATABASE_URL és JWT_SECRET, register/login 503-at ad, session 401-et. DEV-ban JSON orders fallback továbbra is működik.
