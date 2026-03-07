# Technikai és biztonsági audit – teljes átvilágítás

Utolsó frissítés: 2026-02-17.

---

## 1. Architektúra

| Kérdés | Válasz |
|--------|--------|
| **Frontend technológia** | Next.js 14, React 18, Tailwind CSS, TypeScript |
| **Backend technológia** | Next.js API Routes (Edge/Serverless), Node.js |
| **Adatbázis** | PostgreSQL (Prisma ORM). Ha nincs `DATABASE_URL`: JSON fallback (`data/orders.json`). |
| **Hol fut** | Valószínűleg Vercel / serverless (`.vercel` gitignore). Nincs Docker/VPS config a repo-ban. |
| **Prod vs Dev környezet** | Külön választva: `NODE_ENV`, `.env` / `.env.local`, `Secure` cookie csak prod-ban. |

**Státusz:** ✅ Rendszeres.

---

## 2. Hitelesítés és jogosultság

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **Jelszó hash** | ✅ Rendben | bcrypt, cost 12 (`bcrypt.hash(password, 12)`) |
| **Brute force védelem (login)** | ❌ Hiányzik | Nincs rate limit a `/api/auth/login` endpointon |
| **Rate limit (általános)** | ✅ Részben | Van `rate-limit.ts` (60/perc/IP), de a **login** nincs rate limitálva |
| **Session cookie HttpOnly + Secure** | ✅ Rendben | `HttpOnly`, prod-ban `Secure`, `SameSite=Lax` |
| **Admin védett** | ✅ Rendben | `X-Admin-Key` header, ha nincs `ADMIN_API_KEY` → 503 |
| **2FA / IP whitelist adminhoz** | ❌ Hiányzik | Nincs implementálva |

**Kritikus indulás előtt:** Login rate limit (pl. 5–10 kísérlet / perc / IP).

---

## 3. API és backend biztonság

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **Input validáció** | ✅ Rendben | Zod a register, login, checkout, create-checkout-session, chat, newsletter |
| **SQL injection védelem** | ✅ Rendben | Prisma ORM (paraméterezett lekérdezések) |
| **XSS védelem** | ✅ Rendben | React default escape; `dangerouslySetInnerHTML` csak JsonLd/Breadcrumbs szerver adattal |
| **CSRF védelem** | ✅ Részben | `SameSite=Lax` cookie csökkenti a kockázatot |
| **CORS wildcard prod-ban** | ✅ Rendben | Nincs wildcard; Next.js same-origin API |
| **Env változók nem hardcode-olva** | ✅ Rendben | `process.env.*`, `.gitignore`: `.env`, `.env*.local` |

---

## 4. Fizetési rendszer

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **Kártyaadat nem a saját szerveren** | ✅ Rendben | Stripe Checkout – redirect, kártyaadat nem érinti a backendet |
| **Webhook signature validáció** | ✅ Rendben | `stripe.webhooks.constructEvent(body, signature, webhookSecret)` |
| **Order → paid csak hitelesített fizetés után** | ✅ Rendben | Stripe webhook: `payment_status === 'paid'`, összeg egyezés, `amount_total` ellenőrzés |
| **Dupla fizetés elleni védelem** | ✅ Rendben | `paidWebhookEventId` – ugyanaz event id esetén nem frissít újra |
| **Provider-fügő payment webhook** | ✅ Rendben | `PAYMENTS_WEBHOOK_SECRET` + `X-Webhook-Secret` header, 503 ha nincs env |

---

## 5. Időzített / aukciós (sourcing) logika

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **Lejárat backend oldalon ellenőrzött** | ✅ Rendben | `getTimedPurchaseStatus()` a checkout-ban és create-checkout-ban |
| **Időzóna egységes** | ⚠️ Figyelni | `new Date()` szerver óra; `saleFrom`/`saleTo` ISO string – gyakorlatban UTC-hoz közel |
| **Lejárt termék nem vásárolható** | ✅ Rendben | `timedStatus !== 'ACTIVE'` → 400 a checkout-ban |
| **Race condition (maxOrders)** | ⚠️ Potenciális | `getProductOrdersCount` → `getTimedPurchaseStatus` → `createCheckoutOrders` nem atomi. Két egyidejű kérés esetén mindkettő átmehet, ha utolsó slot. DB tranzakció / pesszimista lock javítaná. |

**Javítható később:** Pesszimista lock vagy „SELECT … FOR UPDATE” sourcing rendelésnél, vagy optimista concurrency (pl. `maxOrders - 1` és constraint ellenőrzés).

---

## 6. Infrastruktúra

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **HTTPS mindenhol** | ✅ Rendben | Vercel/hosting által biztosítva |
| **Security headers** | ✅ Rendben | Middleware: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, CSP |
| **CSP** | ⚠️ Enyhíthető | `script-src 'unsafe-inline' 'unsafe-eval'` – Next.js miatt gyakori; később szigorítható |
| **Backup rendszer** | ❓ Platform | Nem a kódban; hosting (Vercel/DB szolgáltató) felelőssége |
| **Logging + monitoring** | ✅ Rendben | Pino logger, Sentry integráció |
| **Prod hibák nem mutatnak stack trace-t** | ✅ Rendben | `error.tsx`: generikus üzenet; API catch: általában „Internal error” |

---

## 7. Terhelés és stabilitás

| Szempont | Státusz | Megjegyzés |
|----------|---------|------------|
| **200+ egyidejű felhasználó** | ⚠️ Platform függő | Serverless (Vercel) skáláz; limit a cold start és DB connection pool |
| **Cache** | ❌ Nincs Redis | In-memory rate limit, idempotency – instance-onként, nem megosztott |
| **Rate limiting kritikus endpointokon** | ✅ Rendben | Checkout, chat, newsletter, like, wishlist – 60/perc/IP |
| **Idempotencia** | ✅ Rendben | Checkout: `Idempotency-Key` header, 24 órás cache |

**Megjegyzés:** Redis/Upstash ajánlott a rate limit és idempotency megosztott tárolásához több instance esetén.

---

## Összefoglaló – státusz tábla

### ✅ Mi van már rendben

- bcrypt jelszó hash (cost 12)
- HttpOnly + Secure session cookie (prod)
- Admin API kulcs védett (503 ha nincs `ADMIN_API_KEY`)
- Stripe webhook signature validáció
- Payments webhook secret (`PAYMENTS_WEBHOOK_SECRET` + header)
- Input validáció (Zod) a fontos endpointokon
- SQL injection védelem (Prisma)
- XSS védelem (React)
- Rate limit: checkout, chat, newsletter, like, wishlist
- Security headers (HSTS, CSP, X-Frame-Options, stb.)
- Idempotencia a checkout-on
- Dupla webhook feldolgozás elleni védelem
- Környezeti változók nem commitolva

### ❌ Mi hiányzik

- Login rate limit / brute force védelem
- Loyalty API rate limit (`GET /api/loyalty?email=...` – e-mail enumeráció kockázat)
- Admin 2FA / IP whitelist

### 🔴 Mi kritikus indulás előtt

1. **Login rate limit** – pl. 5–10 sikertelen kísérlet / perc / IP, vagy általános 60/perc (mint más endpointok).
2. **ADMIN_API_KEY** és **PAYMENTS_WEBHOOK_SECRET** élesben beállítva (lásd PRODUCTION-CHECKLIST.md).

### 🟡 Mi javítható később

1. **Sourcing race condition** – pesszimista lock vagy optimista concurrency a `maxOrders` ellenőrzésnél.
2. **Redis rate limit** – megosztott limit több serverless instance között.
3. **CSP szigorítás** – `unsafe-inline` / `unsafe-eval` csökkentése, ha működés megmarad.
4. **Argon2** – bcrypt helyett (ha szabványkövetés prioritás).
5. **Loyalty API rate limit** – csökkenti az e-mail enumeráció kockázatát.
6. **Idempotency Redis/DB** – in-memory helyett tartós tárolás.

---

## Kapcsolódó dokumentumok

- [BIZTONSAGI-AUDIT.md](./BIZTONSAGI-AUDIT.md) – részletes kockázati elemzés
- [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) – deploy előtti ellenőrzőlista
- [ENV.md](./ENV.md) – környezeti változók dokumentációja
