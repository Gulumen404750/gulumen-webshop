# Projekt állapota – teljes folyamat, ahol most tartunk

Utolsó frissítés: 2026-02-14

---

## 1. Rövid áttekintés

A **Gulumen** egy minimalist e-commerce webshop: vegyes termékek (táskák, ruházat, elektronika, kiegészítők), AI ügyfélszolgálat (HU/EN/DE/RO), kosár, checkout, időzített beszerzési ajánlatok, **like/kedvencek** (nyilvános számláló + user-specifikus kedvencek lista). A fizetés provider-független (jelenleg Dummy; Stripe opcionális, régi flow megmaradt).

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
| `/profil` | Profil / bejelentkezés (userId localStorage) |
| `/regisztracio` | Regisztráció (e-mail, kupon) |

### API route-ok (`src/app/api/`)

| Endpoint | Leírás |
|----------|--------|
| **Like / kedvencek** | |
| `GET /api/products/[id]/like` | Nyilvános likesCount + user liked (X-User-Id opcionális) |
| `POST /api/products/[id]/like` | Toggle like (kötelező X-User-Id, 401 ha nincs) |
| `GET /api/me/wishlist` | User kedvencei (productIds), kötelező X-User-Id |
| **Checkout / fizetés** | |
| `POST /api/checkout` | Egy gombos checkout: items, customer, 1–2 Order, 1–2 PaymentTransaction, provider |
| `GET /api/orders/by-group?order_group_id=` | Csoport rendelései (siker oldal) |
| `GET /api/orders/by-session?session_id=` | Régi Stripe flow – egy rendelés session alapján |
| `POST /api/payments/webhook` | Provider webhook: transactionId, status → Order status frissítés |
| `POST /api/admin/sourcing/[orderId]/success` | Sourcing sikeres → capture auth, Order fulfilled |
| `POST /api/admin/sourcing/[orderId]/fail` | Sourcing sikertelen → cancel auth, Order sourcing_failed |
| **Egyéb** | |
| `POST /api/stripe/create-checkout-session` | Régi Stripe checkout (opcionális, nem az új flow része) |
| `POST /api/stripe/webhook` | Stripe webhook (checkout.session.completed stb.) |
| `POST /api/chat` | AI ügyfélszolgálat (HU/EN/DE) |
| `GET /api/loyalty?email=` | Hűségkedvezmény % e-mail alapján |
| `POST /api/newsletter/route` | Newsletter feliratkozás |

---

## 3. Like / kedvencek rendszer (aktuális, 2026-02-14)

### Cél

- **Nyilvános számláló**: A „❤️ 27” mindenkinek ugyanaz (likesCount).
- **User-specifikus szív**: Csak a bejelentkezett user látja a saját „liked” állapotát (szív kitöltve / üres).
- **Privát kedvencek lista**: Nincs globális state; a lista csak userId alapján, szerverről (GET /api/me/wishlist).

### Adatmodell

- **ProductLike** tároló: `src/lib/product-likes.ts`  
  Fájl: `data/product-likes.json` – tömb: `{ productId, userId, createdAt }`.  
  Unique: (productId, userId) → 1 like / user / termék.
- **Függvények**: `getLikesCount(productId)`, `hasLike(productId, userId)`, `toggleLike(productId, userId)`, `getLikedProductIdsByUser(userId)`.

### API

- **GET /api/products/[id]/like**  
  Header: `X-User-Id` opcionális.  
  Válasz: `{ likesCount: number, liked: boolean }`. Ha nincs user, `liked: false`.
- **POST /api/products/[id]/like**  
  Header: `X-User-Id` kötelező (nincs → 401).  
  Toggle; válasz: `{ likesCount, liked }`.
- **GET /api/me/wishlist**  
  Header: `X-User-Id` kötelező.  
  Válasz: `{ productIds: string[] }`.

### Frontend

- **ProductCard** (`src/components/ProductCard.tsx`):  
  `liked` és `likesCount` csak API-ból (GET like; ha van userId, küldi az `X-User-Id`-t). Kattintás: nincs user → toast „Jelentkezz be a kedveléshez”; van user → optimista frissítés, POST, hiba esetén visszaállítás. **Nincs** localStorage és **nincs** globális wishlist state a szív állapothoz.
- **WishlistContext** (`src/context/WishlistContext.tsx`):  
  Lista **csak szerverről**: GET /api/me/wishlist (userId alapján). Nincs localStorage. `syncFromServer()` a like toggle után hívható.
- **Kedvencek oldal** (`/kedvencek`): A context `productIds` alapján listáz; bejelentkezés nélkül üres.
- **Termékoldal** (`/termek/[slug]`): Ugyanaz a minta: liked/likesCount az API-ból, kattintásnál POST + X-User-Id.

### Auth (user azonosítás)

- **AuthContext** (`src/context/AuthContext.tsx`): `userId` localStorage-ból (`gulumen-user-id`). Nincs még Google OAuth; a kliens az `userId`-t küldi az API-nak az **X-User-Id** headerben. Később: session/cookie vagy OAuth, továbbra is X-User-Id vagy session alapján.

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
- Egy gombos checkout, 1–2 Order, 1–2 PaymentTransaction, provider (Dummy), webhook, admin sourcing success/fail.  
  Részletes leírás: **FIZETES-RENDSZER-ALLAPOT.md**.

---

## 5. Kapcsolódó fájlok – gyors referencia

| Terület | Fájlok |
|--------|--------|
| Like / kedvencek | `src/lib/product-likes.ts`, `src/app/api/products/[id]/like/route.ts`, `src/app/api/me/wishlist/route.ts`, `ProductCard.tsx`, `WishlistContext.tsx`, `termek/[slug]/page.tsx`, `kedvencek/page.tsx` |
| Auth | `src/context/AuthContext.tsx` |
| Wallet hiba | `src/components/WalletErrorGuard.tsx` (layout) |
| Fejléc | `src/components/Header.tsx` |
| Kosár / modal | `CheckoutSourcingModal.tsx`, `kosar/page.tsx`, `CartDrawer.tsx` |
| Képek / 360° | `Lightbox.tsx`, `Product360Viewer.tsx` |
| Időzített / countdown | `SourcingDealBox.tsx`, `SourcingDealCardCountdown.tsx`, `data.ts` |
| Checkout / fizetés | `src/app/api/checkout/route.ts`, `fizetes/page.tsx`, `fizetes/siker/page.tsx`, `payment-provider.ts`, `orders.ts`, `payment-transactions.ts` |
| Fordítások | `src/i18n/translations/hu.json`, `en.json`, `de.json`, `ro.json` |

---

## 6. Ismert megjegyzések / hibák

- **Build**: `npm run build` a Stripe webhook route miatt hibázhat, ha nincs `STRIPE_SECRET_KEY` (vagy megfelelő env) – „Neither apiKey nor config.authenticator provided”. Ez a like/kedvencek módosításoktól független.
- **Like tárolás**: Jelenleg fájl (`data/product-likes.json`). Élesben DB (PostgreSQL/Redis) ajánlott.
- **Auth**: Nincs még Google (vagy más) OAuth; userId localStorage-ból jön; két különböző fiók ugyanazon eszközön ugyanazt a kulcsot használná, amíg nincs session/OAuth.

---

## 7. Következő lépések (opcionális)

- Stripe env beállítása a buildhez, vagy a webhook route lazy/optional kezelése.
- Éles like tárolás: DB (pl. PostgreSQL ProductLike tábla).
- Bejelentkezés: Google (vagy más) OAuth + session, userId helyett vagy mellett.
- Régi `docs/KEDVELESSZAM-NYILVANOS.md` frissítése vagy eltávolítása (az új rendszer ProductLike + X-User-Id alapú).

---

*A fizetési rendszer részletes leírása: **FIZETES-RENDSZER-ALLAPOT.md**.*
