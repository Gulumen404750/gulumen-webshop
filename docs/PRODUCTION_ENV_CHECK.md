# Production Environment ellenőrzés (Railway / deploy)

Ellenőrizve a kód alapján: melyik env változó van jelen, hiányzik, nincs használva, van-e fallback, van-e 503 kritikus hiányra.

---

## 1. NODE_ENV

| | |
|--|--|
| **Jelen van?** | Igen – a kód használja (nem feltétlenül állítod te Railway-on; Railway gyakran automatikusan `production`). |
| **Használat** | `src/lib/prisma.ts` – log szint; `src/lib/logger.ts` – isDev; `src/lib/auth.ts` – cookie `Secure` flag productionban. |
| **Fallback** | Nincs explicit fallback a kódban; Next/Node alapból `development` ha nincs megadva. |
| **503 kritikus hiányra?** | Nincs; hiány esetén dev módban fut (pl. cookie nem Secure). **Productionban állítsd:** `NODE_ENV=production`. |

---

## 2. DATABASE_URL

| | |
|--|--|
| **Jelen van?** | Igen – `isDbConfigured()` ezt nézi (`src/lib/prisma.ts`: `process.env.DATABASE_URL`). |
| **Használat** | Prisma kapcsolat, auth (login/register), orders, reservations, admin audit. |
| **Fallback** | Ha nincs vagy üres: orders JSON fallback (`data/orders.json`), auth 503. Nincs default URL a kódban. |
| **503 kritikus hiányra?** | **Igen.** `/api/auth/login` és `/api/auth/register`: ha `!isDbConfigured()` → **503** `{ error: 'Auth not configured' }`. |

**Production:** kötelező production Postgres URL (nem localhost/dev). Pl. Railway Postgres: `DATABASE_URL="postgresql://..."`.

---

## 3. STRIPE_SECRET_KEY

| | |
|--|--|
| **Jelen van?** | Igen. |
| **Használat** | `src/app/api/stripe/webhook/route.ts`, `create-checkout-session/route.ts`, `api/orders/by-session/route.ts`. |
| **Fallback** | Nincs; hiány esetén a route 501 vagy 500 (lásd alább). |
| **503 kritikus hiányra?** | **Nem 503.** Stripe webhook: **501** `Stripe not configured`; create-checkout-session: **501**; by-session: **500**. |

**Production:** LIVE kulcs (nem test `sk_test_`). Élesben `sk_live_...`.

---

## 4. STRIPE_WEBHOOK_SECRET

| | |
|--|--|
| **Jelen van?** | Igen – a Stripe webhook route-ban (`src/app/api/stripe/webhook/route.ts`) a `getStripe()` mindkettőt nézi: `STRIPE_SECRET_KEY` és `STRIPE_WEBHOOK_SECRET`. |
| **Használat** | Csak Stripe webhook – `constructEvent(body, signature, webhookSecret)`. |
| **Fallback** | Nincs; ha bármelyik hiányzik, `getStripe()` null → **501** `Stripe not configured`. |
| **503 kritikus hiányra?** | Nem (501). |

**Production:** a **LIVE** webhook endpoint-hoz tartozó signing secret (Stripe Dashboard → Webhooks → endpoint → Signing secret).

---

## 5. ADMIN_API_KEY

| | |
|--|--|
| **Jelen van?** | Igen. |
| **Használat** | `src/app/api/admin/sourcing/[orderId]/success/route.ts` és `fail/route.ts` – header `x-admin-key` egyezik. |
| **Fallback** | Nincs. |
| **503 kritikus hiányra?** | **Igen.** Ha `!adminKey` → **503** `{ error: 'Admin not configured' }`. |

**Production:** erős titok; csak backend/admin hívásokhoz (pl. cron, belső script).

---

## 6. PAYMENTS_WEBHOOK_SECRET

| | |
|--|--|
| **Jelen van?** | Igen. |
| **Használat** | `src/app/api/payments/webhook/route.ts` – `X-Webhook-Secret` header egyezik. |
| **Fallback** | Nincs. |
| **503 kritikus hiányra?** | **Igen.** Ha nincs beállítva → **503** `{ error: 'Webhook not configured' }`. |

**Production:** a payment provider (Stripe/Barion/dummy) által küldött titok; egyezzen a provider és az env érték.

---

## 7. NEXTAUTH_SECRET

| | |
|--|--|
| **Jelen van?** | **Nem** – nincs hivatkozás a kódban. |
| **Használat** | Nincs; a projekt **nem** használ NextAuth-ot, hanem saját JWT session-t (`src/lib/auth.ts`). |
| **Hiányzik?** | Nem “hiányzik” – nem használt. NextAuth-ot ne állíts be productionban. |
| **503** | Nem releváns. |

---

## 8. JWT_SECRET

| | |
|--|--|
| **Jelen van?** | Igen – `src/lib/auth.ts`: `process.env.JWT_SECRET`. |
| **Használat** | Session cookie aláírás (jose: SignJWT / jwtVerify). `getSecret()`: ha nincs vagy &lt; 16 karakter → null. |
| **Fallback** | Nincs értékfallback; hiány esetén `getSession()` → null, `createSession()` → **throw Error('JWT_SECRET not configured')** (kezeletlen → **500**). |
| **503 kritikus hiányra?** | **Igen.** Login és register: ha `!isDbConfigured() \|\| !isJwtConfigured()` → **503** `Auth not configured`. (`isJwtConfigured()` = JWT_SECRET legalább 16 karakter.) |

**Production:** kötelező; legalább 16 karakter. Pl. `openssl rand -hex 32`.

---

## Összefoglaló táblázat

| Változó | Jelen | Használva | Fallback | 503 ha hiányzik? |
|---------|--------|-----------|----------|-------------------|
| NODE_ENV | Igen | Igen | Nincs (default dev) | Nem |
| DATABASE_URL | Igen | Igen | Nincs (auth 503, orders JSON) | **Igen** (auth) |
| STRIPE_SECRET_KEY | Igen | Igen | Nincs | Nem (501/500) |
| STRIPE_WEBHOOK_SECRET | Igen | Igen | Nincs | Nem (501) |
| ADMIN_API_KEY | Igen | Igen | Nincs | **Igen** |
| PAYMENTS_WEBHOOK_SECRET | Igen | Igen | Nincs | **Igen** |
| NEXTAUTH_SECRET | Nem | **Nem** | – | – |
| JWT_SECRET | Igen | Igen | Nincs | **Igen** (auth login/register 503) |

---

## Melyik hiányzik a listából?

- A fenti listában **mindegyik** kért változó szerepel.
- **NEXTAUTH_SECRET** – szándékosan nincs használva (nincs NextAuth).

---

## Biztonsági mechanizmusok (503 / explicit “not configured”)

- **503** explicit “kritikus env hiányzik” jelzés:
  - **DATABASE_URL** (auth): login + register → 503 `Auth not configured`.
  - **ADMIN_API_KEY**: admin sourcing success/fail → 503 `Admin not configured`.
  - **PAYMENTS_WEBHOOK_SECRET**: payments webhook → 503 `Webhook not configured`.
- **Nem 503**, de “not configured” kezelés:
  - **STRIPE_***: 501 `Stripe not configured` (webhook, create-checkout-session); by-session 500.
  - **JWT_SECRET**: login és register ellenőrzik `isJwtConfigured()` → hiány esetén **503** `Auth not configured`.

---

## Railway / production checklist

Éles deploy előtt ellenőrizd:

1. **NODE_ENV=production**
2. **DATABASE_URL** – production Postgres (Railway Postgres vagy külső), nem localhost.
3. **STRIPE_SECRET_KEY** – LIVE (`sk_live_...`), nem test.
4. **STRIPE_WEBHOOK_SECRET** – az éles webhook endpoint signing secretje.
5. **ADMIN_API_KEY** – beállítva, erős titok.
6. **PAYMENTS_WEBHOOK_SECRET** – beállítva, egyezik a providerrel.
7. **JWT_SECRET** – legalább 16 karakter (pl. `openssl rand -hex 32`).
8. **NEXTAUTH_SECRET** – nem kell (nem használt).

Opcionális (nem 503-hoz kötött): **NEXT_PUBLIC_APP_URL** (siker/cancel redirect, email linkek) – productionban érdemes a valós domainre állítani; kódban van fallback (`https://gulumen.hu` / `http://localhost:3000`).
