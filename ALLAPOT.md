# Projekt állapota – teljes folyamat, ahol most tartunk

Utolsó frissítés: 2026-07-15

---

## 1. Rövid áttekintés

A **Gulumen** egy minimalist e-commerce webshop: vegyes termékek (táskák, ruházat, elektronika, kiegészítők), AI ügyfélszolgálat (HU/EN/DE/RO), kosár, checkout, időzített beszerzési ajánlatok, **like/kedvencek** (nyilvános számláló + user-specifikus kedvencek lista). A fizetés provider-független: **Stripe** ha `STRIPE_SECRET_KEY` be van állítva, különben **DummyProvider** (mock). A régi Stripe-only flow (`/api/stripe/*`) megmaradt kompatibilitás miatt.

**Termékek:** élesben **DB-first** (Prisma `Product` tábla); `DATABASE_URL` nélkül dev fallback a `data.ts` mock listára. **Auth:** httpOnly session cookie (`gulumen-session` JWT + opcionális Google OAuth NextAuth cookie), nem kliens oldali `X-User-Id` header.

---

## 2. Oldalak és API-k (struktúra)

### Oldalak (`src/app/`)

| Útvonal | Leírás |
|--------|--------|
| `/` | Főoldal: hero, kategóriák, újdonságok/akciók grid, trust strip, regisztráció CTA |
| `/termekek` | Bolti lista: szűrők, rendezés, 3 oszlopos grid |
| `/termek/[slug]` | Termékoldal: galéria, lightbox, 360°, ár, készlet, kosárba, like gomb |
| `/akciok`, `/ujdonsagok` | Akciók / újdonságok listák |
| `/beszerzesre-rendelheto` | Időzített beszerzési ajánlatok |
| `/kosar` | Kosár, véglegesítés, checkout modal (sourcing disclaimer) |
| `/fizetes` | Fizetés: egy gomb (kártyás), e-mail, kupon/loyalty |
| `/fizetes/siker` | Siker: order_group_id vagy session_id, raktári/beszerzéses blokkok, polling |
| `/fizetes/megszakitva` | Megszakított fizetés |
| `/kedvencek` | Kedvencek lista (csak bejelentkezve, szerverről) |
| `/szallitas`, `/visszakuldes`, `/kapcsolat` | Statikus infó oldalak |
| `/profil` | Profil / bejelentkezés (session cookie alapján) |
| `/regisztracio` | Regisztráció (e-mail, kupon) |

### API route-ok (`src/app/api/`)

| Endpoint | Leírás |
|----------|--------|
| **Auth** | |
| `POST /api/auth/register` | Regisztráció (bcrypt, Prisma User), session cookie |
| `POST /api/auth/login` | Bejelentkezés, rate limit, session cookie |
| `POST /api/auth/logout` | Kijelentkezés, cookie törlés |
| `GET /api/auth/session` | Bejelentkezett user (cookie alapján) vagy 401 |
| `GET/POST /api/auth/[...nextauth]` | Google OAuth (NextAuth) |
| **Termékek** | |
| `GET /api/products` | Aktív storefront termékek (DB-first, mock fallback) |
| **Like / kedvencek** | |
| `GET /api/products/[id]/like` | Nyilvános likesCount + user liked (session cookie, `credentials: include`) |
| `POST /api/products/[id]/like` | Toggle like (kötelező session, 401 ha nincs) |
| `GET /api/me/wishlist` | User kedvencei (productIds + products), kötelező session |
| **Checkout / fizetés** | |
| `POST /api/checkout` | Egy gombos checkout: items, customer, 1–2 Order, 1–2 PaymentTransaction, provider |
| `GET /api/orders/by-group?order_group_id=` | Csoport rendelései (siker oldal) |
| `GET /api/orders/by-session?session_id=` | Régi Stripe flow – egy rendelés session alapján |
| `POST /api/payments/webhook` | Provider webhook: transactionId, status → Order status frissítés + rendelés e-mail (Resend) |
| `POST /api/admin/sourcing/[orderId]/success` | Sourcing sikeres → capture auth, Order fulfilled |
| `POST /api/admin/sourcing/[orderId]/fail` | Sourcing sikertelen → cancel auth, Order sourcing_failed |
| **Egyéb** | |
| `POST /api/stripe/create-checkout-session` | Régi Stripe checkout (opcionális, nem az új flow része) |
| `POST /api/stripe/webhook` | Stripe webhook (checkout.session.completed stb.) |
| `POST /api/chat` | AI ügyfélszolgálat (HU/EN/DE) |
| `GET /api/loyalty?email=` | Hűségkedvezmény % e-mail alapján |
| `POST /api/newsletter` | Newsletter feliratkozás |

---

## 3. Like / kedvencek rendszer (aktuális, 2026-07-15)

### Cél

- **Nyilvános számláló**: A „❤️ 27” mindenkinek ugyanaz (likesCount).
- **User-specifikus szív**: Csak a bejelentkezett user látja a saját „liked” állapotát (szív kitöltve / üres).
- **Privát kedvencek lista**: Nincs globális state; a lista csak userId alapján, szerverről (GET /api/me/wishlist).

### Adatmodell

- **ProductLike** (Prisma): `productId`, `userId` → User, `@@unique([productId, userId])`, `countsForDailyBonus`, `createdAt`.  
  Implementáció: `src/lib/product-likes.ts` – **DB-first** (`prisma.productLike`), dev fallback: `data/product-likes.json` ha nincs `DATABASE_URL`.
- **likesCount** a `Product` modellen denormalizált mező (DB); fájl fallback esetén a JSON rekordok száma.
- **Függvények**: `getLikesCount(productId)`, `hasLike(productId, userId)`, `toggleLike(productId, userId)` (+ gamification meta), `getLikedProductIdsByUser(userId)`.

### API

- **GET /api/products/[id]/like**  
  Session: `getSession(request)` a `gulumen-session` / NextAuth cookie-ból. Kliens: `fetch(..., { credentials: 'include' })`.  
  Válasz: `{ likesCount: number, liked: boolean }`. Ha nincs session, `liked: false`.
- **POST /api/products/[id]/like**  
  Session kötelező (`resolveSessionUserId` → Prisma User.id). Nincs session → 401.  
  Toggle; válasz: `{ likesCount, liked, ... }` (gamification mezők opcionálisan).
- **GET /api/me/wishlist**  
  Session kötelező.  
  Válasz: `{ productIds: string[], products: Product[] }`.

### Frontend

- **ProductCard** (`src/components/ProductCard.tsx`):  
  `liked` és `likesCount` API-ból (GET like, `credentials: 'include'`). Kattintás: nincs user → toast „Jelentkezz be a kedveléshez”; van user → optimista frissítés, POST, hiba esetén visszaállítás. **Nincs** localStorage és **nincs** globális wishlist state a szív állapothoz.
- **WishlistContext** (`src/context/WishlistContext.tsx`):  
  Lista **csak szerverről**: GET /api/me/wishlist (`credentials: 'include'`). Nincs localStorage. `syncFromServer()` a like toggle után hívható.
- **Kedvencek oldal** (`/kedvencek`): A context `productIds` alapján listáz; bejelentkezés nélkül üres.
- **Termékoldal** (`/termek/[slug]`): Ugyanaz a minta: liked/likesCount az API-ból, kattintásnál POST + session cookie.

### Auth (user azonosítás)

- **Szerver**: `getSession(request)` – `gulumen-session` httpOnly JWT cookie (email/jelszó, 30 nap) vagy NextAuth Google cookie. User ID: `resolveSessionUserId(session)` → Prisma `User.id`.
- **AuthContext** (`src/context/AuthContext.tsx`): Mountkor `GET /api/auth/session` (`credentials: 'include'`). Login/register/logout az `/api/auth/*` végpontokon keresztül; cookie-t a szerver állítja. **Google OAuth** támogatott (`loginWithGoogle` → NextAuth). A kliens **nem** küld `X-User-Id` headert.
- **API route-ok**: `src/app/api/auth/login`, `register`, `logout`, `session`, `[...nextauth]`.

### Termékek (DB-first)

- **Prisma `Product` modell**: slug, árak, készlet, képek, sourcing mezők (`type`, `dealStartAt`, `dealEndAt`, `maxOrders`, stb.), `likesCount`.
- **Betöltés**: `src/lib/products.ts` (DB → `Product` típus); `src/lib/data.ts` async függvények (`getProductByIdAsync`, `getAllProductsAsync`, `getProductBySlugAsync`) – **DB ha van `DATABASE_URL`**, különben `mockProducts` fallback.
- **Storefront**: `GET /api/products` → `ProductsContext` a kliensen; kosár/fizetés szerver oldalon mindig `getProductByIdAsync`.
- **Admin**: `GET/POST /api/admin/products` – termék CRUD DB-ben.

### Egyéb

- **WalletErrorGuard** (`src/components/WalletErrorGuard.tsx`): MetaMask/ethereum/wallet hibák ne dobjanak Unhandled Runtime Error-t; csak console.warn + preventDefault.
- **Fordítás**: `wishlist.loginRequired` (hu, en, de, ro).

---

## 4. Korábban elkészült feladatok (összefoglalva)

### Fejléc
- Rendezett felső sáv, „Beszerzésre rendelhető” nem tördelődik. Kategória ikon: `DefaultCategoryIcon` (nagy kezdőbetű JSX-hez).  
  Fájl: `src/components/Header.tsx`.

### Kosár / checkout modal
- Sourcing termék esetén „Rendelés véglegesítése” előtt megerősítő ablak (disclaimer).  
  Fájlok: `CheckoutSourcingModal.tsx`, `kosar/page.tsx`, `CartDrawer.tsx`.

### Termék képek
- Lightbox (zoom, pan, lapozás), több kép, opcionális 360° viewer.  
  Fájlok: `Lightbox.tsx`, `Product360Viewer.tsx`, `termek/[slug]/page.tsx`.

### Időzített vásárlás / countdown
- Hydration fix (placeholder „—” mount előtt). Countdown 1 mp tick. `getTimedPurchaseStatus` (NOT_STARTED / ACTIVE / EXPIRED). Checkout és API ellenőrzik ACTIVE-ot.  
  Fájlok: `SourcingDealBox.tsx`, `data.ts`, `create-checkout-session`, `fizetes/page.tsx`.

### Fizetési rendszer (részletes)
- Egy gombos checkout, 1–2 Order, 1–2 PaymentTransaction, provider (Stripe vagy Dummy), webhook, admin sourcing success/fail, rendelés megerősítő e-mail (Resend, `src/lib/order-email.ts`).  
  Részletes leírás: **FIZETES-RENDSZER-ALLAPOT.md**.

---

## 5. Kapcsolódó fájlok – gyors referencia

| Terület | Fájlok |
|--------|--------|
| Like / kedvencek | `src/lib/product-likes.ts`, `src/app/api/products/[id]/like/route.ts`, `src/app/api/me/wishlist/route.ts`, `ProductCard.tsx`, `WishlistContext.tsx`, `termek/[slug]/page.tsx`, `kedvencek/page.tsx` |
| Auth | `src/lib/auth.ts`, `src/context/AuthContext.tsx`, `src/app/api/auth/*` |
| Termékek (DB) | `src/lib/products.ts`, `src/lib/data.ts`, `src/app/api/products/route.ts`, `src/context/ProductsContext.tsx`, `prisma/schema.prisma` (Product) |
| Wallet hiba | `src/components/WalletErrorGuard.tsx` (layout) |
| Fejléc | `src/components/Header.tsx` |
| Kosár / modal | `CheckoutSourcingModal.tsx`, `kosar/page.tsx`, `CartDrawer.tsx` |
| Képek / 360° | `Lightbox.tsx`, `Product360Viewer.tsx` |
| Időzített / countdown | `SourcingDealBox.tsx`, `SourcingDealCardCountdown.tsx`, `data.ts` |
| Checkout / fizetés | `src/app/api/checkout/route.ts`, `fizetes/page.tsx`, `fizetes/siker/page.tsx`, `payment-provider.ts`, `stripe-provider.ts`, `orders.ts`, `payment-transactions.ts`, `order-email.ts` |
| Fordítások | `src/i18n/translations/hu.json`, `en.json`, `de.json`, `ro.json` |

---

## 6. Ismert megjegyzések / hibák

- **Build**: `npm run build` a Stripe webhook route miatt hibázhat, ha nincs `STRIPE_SECRET_KEY` (vagy megfelelő env) – „Neither apiKey nor config.authenticator provided”. Ez a like/kedvencek módosításoktól független.
- **Dev fallback**: `DATABASE_URL` nélkül ProductLike és termékek fájl/mock forrásból jönnek – élesben mindkettőhöz DB szükséges.
- **Auth**: JWT titok (`JWT_SECRET` / `AUTH_SECRET`) kötelező session cookie-hoz; Google OAuth-hoz `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`.

---

## 7. Következő lépések (opcionális)

- Stripe env beállítása a buildhez, vagy a webhook route lazy/optional kezelése.
- Régi `docs/KEDVELESSZAM-NYILVANOS.md` frissítése vagy eltávolítása (a jelenlegi rendszer session + Prisma ProductLike alapú).

---

*A fizetési rendszer részletes leírása: **FIZETES-RENDSZER-ALLAPOT.md**.*
