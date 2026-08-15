# Gulumen webshop – totális rendszermélyelemzés (60 kérdés)

**Dátum:** 2026-08-15  
**Bázis:** `main` @ `ef5cea3` (`chore: force Railway redeploy after order API security fix`)  
**Repo:** `Gulumen404750/gulumen-webshop`  
**Éles:** `https://www.gulumen.com` (Railway service: **gulumen-webshop**, Source branch: **master**)  
**Módszer:** kódbázis, Prisma-séma, lockfile, CI/deploy config, git history, 2026-os piaci díjszabás. Nem találgatás a futó Railway dashboardról — ahol az éles env nem olvasható, azt külön jelezzük.

---

## Executive Summary (előre)

A Gulumen **egyedi Next.js 14 App Router + Prisma 6 + PostgreSQL** webshop, Stripe Checkout-tal, önkiszolgáló címmódosítással, RBAC adminnal, gamifikációval és AI-asszisztenssel. A **szoftvermag kereskedelmi úton üzemkész** (éles health 2026-08-09: live + DB ready). A **2000 termékes, számlázós, GDPR-sütis, futárcímkés** kereskedelmi indulás még **nem 100%**.

| Metrika | Érték |
|---------|--------|
| Szoftveres készültség (jelenlegi katalógus, kártyás fizetés) | **84%** |
| Kereskedelmi élesítés 2000 SKU-val + számla + cookie CMP + futár API | **68%** |
| API route-ok | 101 |
| Prisma migrációk | 47 |
| Vitest fájlok | 89 |
| Playwright e2e | 6 |
| Seed katalógus | 35 SKU |
| Dev mock | 68 SKU |

**Azonnali kockázatok élesítés előtt:** Upstash Redis az élesen 2026-08-09-én `skipped` volt (multi-instance rate-limit gyenge); `postmaster@gulumen.com` domainjén **nincs publikus MX** (bejövő levél elveszhet); Stripe webhook **succeeded retry** csak e-mailt ismétel, nem a rendelés-emelést; nincs Számlázz.hu/Billingo; nincs cookie-banner; Railway cron a `vercel.json`-ból **nem** fut.

---

# I. Architektúra, Tech Stack és Adatbázis Mechanika (1–10)

## 1. Tech stack és verziók

Monolit Next.js alkalmazás, Node **≥20**, app verzió **0.1.2**. Lockfile (`package-lock.json`) szerint:

| Réteg | Csomag | Lock verzió |
|-------|--------|-------------|
| Runtime | Node | ≥20 (nixpacks) |
| Framework | `next` | **14.2.35** |
| UI | `react` / `react-dom` | **18.3.1** |
| Nyelv | `typescript` | **5.9.3** |
| CSS | `tailwindcss` | **3.4.19** |
| ORM | `prisma` / `@prisma/client` | **6.19.3** |
| DB | PostgreSQL | Prisma datasource |
| Fizetés | `stripe` | **20.4.1** |
| Email | `resend` | **6.18.1** |
| Auth | `next-auth` | **4.24.14** + `jose` 5.10.0 JWT |
| Cache / RL | `@upstash/redis` 1.38.2, `@upstash/ratelimit` 2.0.8 |
| Megfigyelés | `@sentry/nextjs` 8.55.2, `pino` 9.14.0 |
| Validáció | `zod` ^4.3.6 |
| 2FA | `otplib` ^13.4.1 |
| Képek | `sharp` ^0.34.5, Bunny CDN |
| Teszt | `vitest` 4.1.10, `@playwright/test` 1.62.1 |

Nincs külön mikroservíz. Nincs Server Action (`"use server"` nincs a kódban) — minden mutáció **Route Handler**.

## 2. Adatbázis séma: termék, rendelés, user, cím

Forrás: `prisma/schema.prisma`.

**Product:** `cuid` id, unique `slug`, 4 nyelvű név/leírás, `aiKnowledgeBase`, ár HUF/EUR + akciós ár + időablak, `stock` (`-1` = végtelen), `variants`/`colorImages` JSON, sourcing mezők (`type`, `dealStartAt`/`dealEndAt`, `maxOrders`), `likesCount`/`viewsCount`, `archived`. Index: `(active, archived)`, `(category, active)`.

**User:** unique email, opcionális `passwordHash` (OAuth = null), marketing GDPR mezők, születésnap + birthday-kupon év, brute-force lockout mezők. Kapcsolatok: Order, ProductLike, LoyaltyRecord, ponttárca, kosár-snapshot, promo kuponok.

**Order:** string id (nem cuid), `status`, opcionális `orderGroupId` (1 checkout = 1–2 rendelés: `in_stock` + `sourcing`), összegek, vevő + szállítási/számlázási cím, `deliveryNotes`, Stripe session/PI, `rewardsFinalized`, `printedAt`.

**Címmódosítás mezői (2026-08-15 migrációk):**

- Aktuális: `shippingPostalCode/City/Street/HouseNumber`, `customerName/Phone`
- Eredeti snapshot: `originalShipping*`, `originalCustomerName/Phone`
- `shippingAddressChangedAt`, unique `shippingEditToken`

**OrderItem:** productId, qty, fulfillmentType, priceHuf. **PaymentTransaction:** CAS státusz, unique `providerRef` (dupla webhook ellen).

## 3. Adatbázis-biztonság (injekció / jogosulatlan lekérdezés)

- **Prisma ORM** — paraméterezett query; nincs string-összefűzött SQL.
- Raw SQL csak tagged template: `inventory.ts` (`stock - ${qty}`), health `SELECT 1`, birthday coupon. Prisma bindeli a paramétereket.
- Publikus order API **whitelist** (`order-public.ts`) — PII és `shippingEditToken` nem megy ki vendégnek.
- Admin: JWT + IP allowlist + CSRF + rejtett slug + RBAC.
- Checkout **ignorálja** a kliens `discountPercent` / `isDiscountActive` mezőket.
- Titkok: `process.env`, timing-safe compare (`secure-compare.ts`) webhook/cron/admin kulcsokra.
- Nincs publikus Prisma Studio / SQL endpoint.

Maradék: shipping-edit token összehasonlítás sima `!==` (nem timing-safe); `by-group`/`by-session` rate-limit nélkül.

## 4. Cache és session multi-instance környezetben

| Komponens | Hol él | Multi-instance |
|-----------|--------|----------------|
| User session `gulumen-session` | HttpOnly JWT cookie, 30 nap, SameSite=Lax | Igen (stateless) |
| NextAuth Google | JWT cookie | Igen |
| Admin JWT | Cookie, 8 óra / 30 perc idle, `jti` denylist | Redis + DB; Redis nélkül denylist példányonként |
| Rate limit / checkout idempotency | Upstash sliding window | Redis kell; hiányában in-memory Map |
| Next.js Data Cache | Folyamatmemória | Példányonként; shop revalidate helper van |

**Éles 2026-08-09:** `/api/health/ready` → `redis: "skipped"`. Több Railway replica mellett a rate-limit és az admin logout-denylist **nem globális**. Egy példányon ez rendben van.

## 5. Környezeti változók

~63 egyedi kulcs (`.env.example` + `docs/ENV.md` + `docs/RAILWAY_VARIABLES.md`).

**Kötelező éles induláshoz:** `DATABASE_URL`, `JWT_SECRET` (≥16), `ADMIN_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NODE_ENV=production`. Productionben **üres `ADMIN_ALLOWED_IPS` = admin 403 lockout**.

**Fizetés/email:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ORDER_SUPPORT_EMAIL`.

**Opcionális de ajánlott:** `UPSTASH_REDIS_*`, `SENTRY_DSN`, `CRON_SECRET`, `GOOGLE_CLIENT_*`, `RECAPTCHA_*`, `ADMIN_URL_SLUG`, `BUNNY_*`, `OPENAI_API_KEY`, `ADMIN_EMAIL` (anomália/2FA reset — **nem** rendelés-értesítő).

`NEXT_PUBLIC_*` beég a kliens bundle-be. A start script localhost URL-t productionben `https://www.gulumen.com`-ra cseréli.

## 6. Git és Railway/GitHub deploy lánc

```
push master|main → GitHub
  ├─ Railway Source (gulumen-webshop, branch master) → nixpacks build → npm run start
  └─ GitHub Actions railway-deploy.yml → ha van RAILWAY_TOKEN: railway up; különben Source auto-deploy
```

- Build: `scripts/prebuild.cjs` + `prisma generate` + `next build`
- Start (`scripts/start.js` v7): `prisma generate` → **`prisma migrate deploy`** → `next start -H 0.0.0.0 -p $PORT`
- **Nincs seed** deploykor (korábbi bug: seed archiválta a nem-katalógus termékeket)
- Healthcheck: `/api/health/live`, timeout 120s, restart on_failure ×5
- Staging: külön service `gulumen-webshop-staging` (`docs/STAGING.md`)
- CI: lint, vitest, typecheck, Playwright, npm audit, Semgrep

A README szerint az éles Source **master**; a `main` és `master` mindkettő triggerelheti a CLI workflow-t.

## 7. Hibakezelés, logging, monitoring

- **Pino** strukturált log (`src/lib/logger.ts`), szint: `LOG_LEVEL` vagy prod `info`
- **Sentry** server/client/edge + `instrumentation.ts` `onRequestError` — **DSN nélkül no-op**
- Webhook: signature fail → 400; side-effect hiba logolva, e-mail hiba mellett a webhook **200** (Stripe ne retry-eljen végtelenül az e-mail miatt)
- Admin: `AdminAction` audit; anomália-riasztás `ADMIN_EMAIL`-re
- Health: liveness vs readiness szétválasztva (DB blip ne indítson restart-loopot)

Hiány: élő Sentry DSN (audit szerint gyakran nincs); nincs APM/tracing a Prisma querykre.

## 8. Konkurens DB-műveletek nagy terhelés alatt

- Checkout: `prisma.$transaction` + **atomi** `UPDATE Product SET stock = stock - qty WHERE stock < 0 OR stock >= qty` (`inventory.ts`) — 0 sor = `OutOfStockException`
- Sourcing: `ProductReservation` (RESERVED 15 perc → PAID / EXPIRED / CANCELED)
- Payment: `claimPaymentTransactionStatus` CAS — egy instance futtatja a side-effecteket
- Pontok: `UserPointWallet.version` optimistic lock + append-only `PointTransaction` + outbox `PointEvent`
- Kupon `usedCount` rendelés-csoportonként egyszer (`couponUsageRecorded`)
- Stuck payment cron: `cancelPendingOrderWithStockRestore`

Postgres row lock + CAS elég napi százas rendelésre. Napi 500-nál a szűk keresztmetszet a **Stripe + webhook + egy Node példány**, nem a 2000 soros Product tábla.

## 9. TypeScript típusbiztonság

- `tsconfig.json`: **`strict: true`**, `isolatedModules`, path `@/*`
- `src/`-ben `: any` / `as any` gyakorlatilag **0**
- ~12 eslint-disable / `@ts-*`; kevés `as unknown`
- CI: `npm run typecheck` (`tsc --noEmit`)
- Zod a checkout/finalize-rewards/webhook body-n
- Lefedettség: 89 tesztfájl / ~509 src TS(X) ≈ **21% fájlarány** — a kritikus libek (auth, inventory, webhook, shipping-edit, CSRF) teszteltek; a 101 API route-ból ~15-nek van direkt tesztje

## 10. API útvonalak (Route Handlers)

**101** `route.ts`, **0** Server Action. Csoportok:

| Prefix | Szerep |
|--------|--------|
| `/api/checkout` | Kosár → Order + PaymentTransaction + Stripe session |
| `/api/checkout/finalize-rewards` | Siker oldal backup: proof-gated emelés + kupon/pont |
| `/api/payments/webhook` | Elsődleges Stripe + Dummy webhook |
| `/api/stripe/*` | Legacy (create-session **410 Gone**; webhook még él) |
| `/api/orders/by-group`, `by-session` | Siker oldal polling (publikus nézet) |
| `/api/orders/[id]/shipping-edit` | Tokenes címmódosítás |
| `/api/me/*` | Session: profil, rendelés, kosár, wishlist, kupon |
| `/api/auth/*` | Login/register/logout/session + NextAuth |
| `/api/admin/*` | RBAC admin (~47 route) |
| `/api/operator/login` | Operátor, külön süti |
| `/api/gamification/*` | Pont, spin, redeem |
| `/api/cron/*` | Outbox, stuck payment, birthday, retention (`CRON_SECRET`) |
| `/api/health`, `/live`, `/ready` | Probe |
| `/api/chat`, `/api/contact`, newsletter, loyalty, products | Storefront |

---

# II. E-kereskedelem, Fizetés és Webhook Folyamatok (11–20)

## 11. Stripe checkout → webhook

```
/fizetes → POST /api/checkout
  → validáció, szerverár, kupon, pont
  → createCheckoutOrders (stock atomi levonás, status=payment_pending)
  → PaymentTransaction capture (raktár) / authorize (sourcing)
  → Stripe Checkout Session (card, metadata: transactionId, orderId, orderGroupId)
  → redirect success_url=/fizetes/siker?session_id={CHECKOUT_SESSION_ID}
Stripe → POST /api/payments/webhook (stripe-signature)
  → constructEvent → amount/currency check → CAS succeeded
  → capture→paid / authorize→sourcing_pending
  → attach payment details, reservation PAID, finalize rewards, kosár snapshot ürítés, e-mail
Siker oldal → POST /api/checkout/finalize-rewards (Stripe proof backup)
```

`STRIPE_SECRET_KEY` nélkül **DummyProvider** (nincs redirect). Pont-only (total 0) checkoutban azonnal paid.

## 12. Webhook „succeeded azonnali kilépés” és retry

**Ok:** A Stripe újrapróbálja a webhookot. Ha a tranzakció már `succeeded`, a handler **nem claimel újra** (CAS / early return), hogy ne fusson kétszer a paid emelés és a kuponégés.

**Korábbi hiba:** ez a korai `return` a **megerősítő e-mailt is kihagyta**. Ha az első körben a Resend hibázott, a retry már nem küldött levelet.

**Javítás:** `tx.status === 'succeeded'` ágon `maybeSendOrderGroupConfirmationEmail` **újrapróbálása** (idempotens: csak akkor jelöli sentnek, ha a Resend sikerült). Ugyanez a CAS `alreadyInStatus` ágon.

**Maradék rés:** a succeeded retry **nem** futtatja újra: `setOrderStatus`, `finalizeOrderRewards`, `clearUserCartSnapshot`, `markReservationsPaidByOrderId`. Ha a process a CAS után, de a `setOrderStatus` előtt meghal → a rendelés `payment_pending` maradhat, miközben a kártya levonva. Mitigáció: siker oldal `finalize-rewards` Stripe session proof-fal, plusz stuck-payment cron (az viszont pendinget **törölhet**, nem emel).

## 13. Stripe aláírás-ellenőrzés

`stripe.webhooks.constructEvent(rawBody, stripe-signature, STRIPE_WEBHOOK_SECRET)`. Hibás aláírás → **400 Invalid signature**. Hiányzó kulcs → **503**. Nyers `request.text()`, max 64 KB.

Generic (Dummy) út: `X-Webhook-Secret` + `PAYMENTS_WEBHOOK_SECRET` + `secureCompare`.

## 14. Sikeres fizetés, de kosár/rendelésmentés megszakad

| Forgatókönyv | Viselkedés |
|--------------|------------|
| Checkout DB tx fail | Rollback, készlet nem vonódik; sourcing reservation cleanup |
| Stripe levon, webhook nem jön | `payment_pending`, készlet már levonva; stuck cron cancel + restore |
| CAS ok, `setOrderStatus` exception | Tx succeeded; retry csak e-mail — lásd 12. |
| `finalizeOrderRewards` fail | Log; `rewardsFinalized` vissza `false` → később újra lehet |
| E-mail fail | Webhook 200; nincs sent flag → Stripe retry e-mailt küld |
| `clearUserCartSnapshot` throw | Nincs try/catch a payments webhookon → **500** paid után (Stripe retry) |
| Kliens kosár | Siker oldal localStorage ürítés függetlenül a szervertől |

## 15. postmaster@gulumen.com + Resend

`src/lib/mail.ts`: feladó `Gulumen <noreply@gulumen.com>`, `RESEND_API_KEY`.  
`getAdminNotificationEmails()` **mindig** `[postmaster@gulumen.com]` — `ADMIN_EMAIL` és Gmail **szándékosan kihagyva**.

A kód figyelmeztet: `gulumen.com` / `gulumen.hu` **nincs publikus MX** → Resend *elküldi* a levelet, a postmaster **fogadó oldalon elveszhet**. A `railway.toml` kommentje is ezt írja. Éles bejövő ügyfélszolgálathoz MX vagy megbízható inbox kell.

## 16. Automata vásárlói e-mailek rendeléstől kiszállításig

**Van:** rendelés-visszaigazolás (tételek, összeg, szállítás 24–48 óra / 7–14 nap szöveg, címmódosító CTA tokenes linkkel). Reply-To: postmaster.

**Nincs:** feladva / tracking / útban / teljesítve / sourcing-fail kupon e-mail. Az admin sourcing success csak `fulfilled`-re állít, vásárlói mail nélkül.

Egyéb automata: elhagyott kosár (admin trigger), születésnapi kupon cron, hírlevél confirm/unsubscribe.

## 17. `finalize-rewards` és biztonság

`POST /api/checkout/finalize-rewards` (`checkout-rewards.ts` + Stripe proof).

| Bemenet | Státuszemelés | Kupon/pont égés |
|---------|---------------|-----------------|
| `sessionId` | Igen, ha Checkout Session paid / PI authorized | Igen |
| `paymentIntentId` | Ugyanaz a proof kapu (402 ha nem complete) | Igen |
| Csak `orderGroupId` / `orderId` | **Nem** (ne lehessen Dummy-t hamisítani) | Csak ha már paid-like |

További: Zod body; `rewardsFinalized` false→true CAS; kupon `usedCount` csoportonként egyszer; pont `PURCHASE_REDEEM` idempotency key; hiba esetén flag vissza. Commit `77dde99` keményítette, hogy ne lehessen token/PII nélkül emelni.

## 18. Kupon- és árazási logika

- Macska 5%, regisztráció 10%, welcome 10%, birthday 15%, loyalty % — **szerveroldali**
- DB kupon: `percent` (0–100) vagy `fixed` (HUF)
- Kombinált % **max 20%** (`capCombinedCouponPercent`)
- Fix + százalék a full-price subtotalra, spin-sorok kihagyva
- Pontkedvezmény: kosár **max 30%-a**
- Kliens `discountPercent` **elvetve**

## 19. Készlet csökkenés sikeres fizetéskor

**Nem a webhooknál.** A készlet a `createCheckoutOrders` tranzakciójában csökken (`decrementStockAtomic`). Webhook paid: `setOrderPaid` komment: készlet már levonva. Fail/cancel: `restoreStockAtomic`. Sourcing: reservation, nem stock. `stock < 0` = végtelen, nem csökkent.

## 20. Fizetés Stripe-on kívül

| Opció | Kódban |
|-------|--------|
| Stripe card | Igen (`payment_method_types: ['card']`) |
| DummyProvider | Igen, kulcs nélkül |
| Pont-only (0 Ft) | Igen |
| Utánvét / átutalás | **Nincs** provider |
| Barion / SimplePay | Csak komment / jövő |

Az ÁSZF/FAQ még említhet utánvétet — a UI **„Csak kártyás fizetés”**. Eltérés: copy vs kód.

---

# III. Címmódosítási Rendszer és Önkiszolgáló Logisztika (21–30)

## 21. Vásárlói címmódosító felület

- Lista: `/profil/rendelesek` — `CustomerOrderShippingEdit`, ha `canEditShipping`
- Dedikált: `/rendelesek/[id]/modositas` + `?t=` token (e-mail CTA)
- Tokenes: `PATCH /api/orders/:id/shipping-edit` body `{ ...form, t }`
- Session: `PATCH /api/me/orders/:id/shipping`, cookie

## 22. Csak aktív (fel nem adott) rendelés

`order-shipping-edit.ts`: szerkeszthető `paid` | `sourcing_pending`. Zárolt: `fulfilled`, `cancelled`, `failed`, `expired`, `sourcing_failed`, **vagy `printedAt` be van állítva**. Admin címkenyomtatás = vásárlói edit vége. API 409.

## 23. Eredeti cím megőrzése

Első módosításkor, ha még nincs `originalShipping*`, a fizetéskori cím + név/telefon bemásolódik. Későbbi edit nem írja felül az originált. Aktuális mezők a futárnak valók. `shippingAddressChangedAt` timestamp.

## 24. Token vs session

- Token: `randomBytes(24).toString('base64url')`, unique DB, e-mail link `?t=`. Lookup: id + token egyezés. A token **nem** megy vissza API válaszban.
- Session: bejelentkezett `/api/me/orders/...`
- Összehasonlítás jelenleg **nem** timing-safe. A token amíg szerkeszthető, újrafelhasználható (nincs egyszer-használatos rotáció leak után).

## 25. Admin 🔥 ikon

`AdminOrderStatusBadge`: ha `shippingAddressChangedAt` → Lucide `Flame` + „Cím módosítva”. Lista + adatlap.

## 26. Eredeti vs új cím az adminon

`admin/dashboard/orders/[id]`: borostyán panel, **Eredeti** (`original*`) vs **Módosított** (aktuális). Címke a **aktuális** címmel nyomtat.

## 27. E-mail címmódosításkor

`sendAdminAddressChangeNotification` → csak postmaster. Tárgy vásárlónál: `[Gulumen] 🔥 Vásárló címet módosított – {orderId}`. Hívás: token PATCH, session PATCH, admin order PATCH. MX kockázat: 15. kérdés.

## 28. by-group / by-session token-szivárgás

**Volt valós lyuk:** a végpontok a teljes `Order` JSON-t adták, beleértve PII-t és `shippingEditToken`-t.

**Fix:** `77dde99` (2026-08-15) — `toPublicOrderView` whitelist. Vendég/siker oldal: id, status, tételek, összegek, flags. Teljes order csak ha `session.userId === order.userId`.

A leak előtt kiadott tokeneket a kód **nem rotálja**.

## 29. Rate limit

| Endpoint | Limit |
|----------|--------|
| GET shipping-edit | 40/perc |
| PATCH shipping-edit / me shipping | 20/perc |
| GET /api/me/orders | 60/perc (default) |
| **by-group / by-session** | **nincs** |

Redis nélkül a limit folyamat-lokális.

## 30. Futárcímke

**Nincs GLS/Packeta/Foxpost API.** HTML `ShippingLabelCard` + `window.print()`. `POST /api/admin/orders/:id/print` és bulk `/api/admin/orders/print` (max 50) beállítja `printedAt` → edit lock. Integráció pontja később: print helyett courier API, `printedAt` ugyanúgy a kapu.

---

# IV. Adminisztrációs Felület és Biztonság (31–40)

## 31. Admin auth és RBAC

Két belépési út:

1. **Owner:** `/admin/login` (vagy `/{ADMIN_URL_SLUG}/login`) — `ADMIN_API_KEY` + 2FA. Süti: `admin_authorized`.
2. **Operátor:** `/operator/login` — username + bcrypt jelszó. Süti: `operator_authorized` — **nem írja felül** az owner sütit.

Szerepek (`AdminOperator`): `viewer` | `catalog` | `support` | `owner`. Staff UI csak viewer/catalog/support-ot oszt. `requireAdminPermission` / `requireOwner`. Viewer PII redaktálható. Tömeges törlés/ár non-ownernek `AdminPendingApproval` (5 perc, owner).

## 32. 2FA

Singleton `Admin`: TOTP (`otplib`), Google Authenticator. Setup: secret → verify után `isTwoFactorEnabled`. Újrapárosítás: `pendingTotpSecret`, az élő secret megmarad confirmig. Rate limit `adminTotp` 10 / 10 perc. Owner belépés 2FA nélkül nem kap teljes sessiont (pending cookie).

## 33. IP allowlist

`ADMIN_ALLOWED_IPS`: IPv4, CIDR, vagy `*` (ne élesben). **Production + üres lista = minden admin/operator 403.** Dev üresen enged. Middleware a rejtett slugra is. CDN `x-forwarded-for` / `x-real-ip`.

## 34. CSRF

Double-submit: `admin_csrf` cookie + `x-admin-csrf` header + Origin/Referer host check. Mutáló admin API-n middleware. Login Origin-only; `x-admin-key` gép-gép kihagyja. `admin-fetch.ts` patch-eli a `window.fetch`-et az AdminShellben.

## 35. Tömeges rendelés/státusz

- Bulk **címkenyomtatás:** igen (max 50)
- Bulk **státuszváltás** (paid→fulfilled tömegesen): **nincs** külön API
- Sourcing: per-order success/fail (capture / cancel auth)
- Admin order PATCH: vevő/cím, nem generic status machine
- Termék/user bulk: approval workflow

## 36. Audit trail

`AdminAction`: action, orderId, success, details, IP, UA, actorId/username/role. Login, print, export, sourcing, termék, approval, anomália. Hiba logolva, nem dob.

## 37. `1.dani@gmail.com` kitakarítás

Blokkoló lista `support-email.ts`: `1.dani@gmail.com`, `dani@gmail.com`. `getAdminNotificationEmails()` soha nem adja vissza őket, akkor sem, ha `ADMIN_EMAIL` ez. Tesztek: `support-email.test.ts`, `order-email.test.ts`.

**Nem teljesen globális tiltás:** `ADMIN_EMAIL` továbbra is mehet: login fingerprint, anomália, approval, lockout, password reset, voice/callback. Ha a Railway-en `ADMIN_EMAIL=1.dani@gmail.com`, azok a riasztások oda mennek. Rendelés/cím notify **nem**.

## 38. Health a Railway-en

| URL | Szerep |
|-----|--------|
| `GET /api/health` | `{ status: "live", ts }` |
| `GET /api/health/live` | Ugyanaz — Railway liveness |
| `GET /api/health/ready` | DB `SELECT 1` + opcionális Redis ping; 503 ha nem ready |

Middleware HTTPS redirect **kihagyja** a health path-okat (probe loop ellen). 2026-08-09 minta: live 200, ready `db: true`, `redis: skipped`.

## 39. Titkosítás: Resend / Stripe kulcsok

**Nincs** a kódban. Kulcsok Railway Variables / env. `.gitignore` `.env`. Admin API kulcs fingerprint SHA-256 a DB-ben, nyers kulcs nem. TOTP secret a `Admin` táblában **plaintext**. Nincs KMS/Vault. Sentry DSN opcionális.

## 40. Prisma migrate a start scriptben

`scripts/start.js`: `DATABASE_URL` kötelező → `prisma generate` → **`prisma migrate deploy`** → `next start`. Explicit tiltva: seed, migrate reset, db push --force-reset. `ALLOW_PRODUCT_SEED=1` csak figyelmeztet, nem seedel.

---

# V. Készültségi Fok és Hátralévő Feladatok (41–50)

## 41. Százalékos készültség

Súlyozott modell (nem marketing-szám):

| Alrendszer | Súly | Kész | Indok |
|------------|------|------|--------|
| Storefront + kosár + i18n | 12% | 90% | 4 nyelv, reszponzív, 3D/galéria |
| Checkout + Stripe + készlet | 18% | 88% | élő flow; webhook retry rés |
| Admin + RBAC + 2FA | 12% | 92% | érett; bulk status hiány |
| Címmódosítás / címke | 8% | 90% | self-serve kész; courier API nincs |
| Auth + GDPR marketing | 8% | 80% | consent van; cookie CMP nincs |
| Gamifikáció | 6% | 85% | ledger + cron függés |
| Email / MX | 8% | 70% | confirm van; MX + fulfillment mail nincs |
| SEO | 5% | 85% | sitemap/JSON-LD; fallback gulumen.hu |
| Teszt / CI | 7% | 75% | 89 unit, 6 e2e, kevés API teszt |
| Ops (Redis, Sentry, cron) | 8% | 60% | Redis skipped; vercel cron ≠ Railway |
| Számla / NAV | 8% | 5% | nincs integráció |

**Súlyozott összesen: 84%** a *jelenlegi katalógusos, kártyás webshop* értelmében.

**2000 SKU + számla + cookie + futár + MX:** **68%** (a katalógusfeltöltés és a jogi/logisztikai réteg külön projekt).

## 42. Kritikus hiányok élesítés előtt

**P0 / blokkoló kereskedelmi értelemben**

1. `postmaster@gulumen.com` **MX** (vagy bejövő továbbítás Gmailre) — különben címmódosítás/új rendelés notify elveszhet
2. Stripe Dashboard webhook URL: **`/api/payments/webhook`** + `STRIPE_WEBHOOK_SECRET`
3. Upstash Redis élesre (rate-limit + admin denylist + checkout idempotency)
4. Railway **Cron Job** a `CRON_SECRET`-tel (stuck payments, outbox) — `vercel.json` itt nem fut
5. Webhook succeeded path: order elevation + rewards retry (vagy biztosított finalize-rewards)
6. ÁSZF vs UI: utánvét szöveg törlése vagy valódi COD

**P1**

7. Cookie consent, ha GA be van kapcsolva (`NEXT_PUBLIC_GA_MEASUREMENT_ID`)
8. Számlázó (HU B2C: ÁFA-számla) — lásd 43.
9. Sentry DSN
10. `by-group`/`by-session` rate-limit
11. Sourcing-fail vásárlói e-mail + kupon (dokumentált TODO)
12. `clearUserCartSnapshot` try/catch a webhookon
13. Token compare timing-safe + opcionális rotáció a 28-as leak után

**P2:** legacy `/api/stripe/webhook` kivezetés; `FIZETES-RENDSZER-ALLAPOT.md` elavult (2025-ös Dummy-only állítás); sitemap fallback `gulumen.hu`; dedicated `/adatkezeles` oldal.

## 43. Számlázó integráció

**Szükséges a magyar B2C élesítéshez**, ha ÁFA-körös a cég: a Stripe nyugtája **nem** helyettesíti a NAV-álló számlát. A kódban **nincs** Számlázz.hu / Billingo / NAV Online Számla hívás. A billing mezők a csomagoláshoz kellenek.

Javasolt: Billingo vagy Számlázz.hu a `paid` webhook után, idempotensen (`paidWebhookEventId` / order id), PDF a vásárlói e-mailhez. Ez önálló sprint, nem „kapcsoló”.

## 44. Reszponzivitás

Igen, a főfelületek Tailwind `sm/md/lg` + mobil komponensek (`MobileCartStickyBanner`, drawer header, shop grid). Van `e2e/mobile-products.spec.ts`. 100% pixel-perfect minden eszközön nincs automatizált visual regression; a struktúra mobil-first.

## 45. SEO

**Kész:** `sitemap.ts` (statikus + kategória + termék), `robots.ts` (API/kosár/profil tiltva), `site-metadata.ts`, OG, `ProductJsonLd`, `OrganizationJsonLd`, `FaqPageJsonLd`, breadcrumbs, `/products/:slug` → `/termek/:slug`.

**Hiány / drift:** sitemap/robots fallback base `https://gulumen.hu` (éles `www.gulumen.com`); nincs külön privacy URL a sitemapben; 2000 SKU-nál a sitemap egyben jön — később chunkolás; per-termék meta a leírásból, nem külön SEO title mező a sémában.

## 46. Sütikezelés / GDPR

- **Van:** regisztrációs privacy consent, marketing opt-in, `MarketingConsent`, unsubscribe token, lockout/IP hash a chatnél
- **Nincs:** Cookie Consent banner / CMP; a `Analytics.tsx` GA-t **consent nélkül** tölti, ha van Measurement ID
- Nincs külön `/adatkezeles` page; footer ÁSZF + kapcsolat telefonos adatkezelés

Tranzakciós cookie (session) jogos érdek / szerződés; marketing + GA4 **hozzájárulás** nélkül kockázatos.

## 47. Teljesítmény

**Van:** `next/image` AVIF/WebP, Bunny `gulumen.b-cdn.net`, `SafeProductImage` lazy, sharp, deviceSizes.

**Hátra 2000 SKU-nál:** listázás pagináció/kurzor (ha most mindent húz); CDN image transform; 3D/GLB lazy; JS bundle audit; Redis product cache; `colorImages` JSON méret.

## 48. Tesztelés

- **Vitest:** 89 fájl, CI `test:ci`
- **Playwright:** auth, cart, checkout, favorites, mobile-products, theme-chooser
- **Nincs:** Cypress; nincs teljes Stripe webhook e2e (fixture/unit van payment libeken)
- Kritikus path unit: inventory, CSRF, 2FA, shipping-edit, order-public, support-email, payment-transactions

## 49. Dokumentáció

46 fájl `docs/` + README, SECURITY, ALLAPOT, FIZETES-RENDSZER-ALLAPOT (utóbbi **elavult**). Van admin szabályzat, staging, WAF, Railway variables, production checklist, korábbi auditok. Fenntartáshoz ez bőséges; a fizetés-docot szinkronizálni kell a kóddal.

## 50. Lépéssorozat 100%-os élesítésig

Nincs naptári határidő a repóban. Technikai sorrend:

1. DNS MX + postmaster fogadás ellenőrzése  
2. Stripe webhook + test charge (4242) + retry szimuláció  
3. Upstash + Sentry DSN + Railway cron  
4. Webhook elevation retry + cart-clear try/catch  
5. Cookie CMP vagy GA kikapcsolása  
6. ÁSZF/FAQ fizetési szöveg = kártya-only  
7. Számlázó (Billingo/Számlázz) + ÁFA  
8. by-group rate-limit + token timing-safe  
9. Címkenyomtatás próba (`printedAt` lock)  
10. Katalógus 2000: import pipeline, SEO, készlet  
11. Staging → master kapu admin/auth-ra  
12. Futár API ha a volumen megköveteli  

A 1–6 a **jelenlegi** shop biztonságos kártyás indulásához; 7+10 a 2000 SKU kereskedelmi 100%.

---

# VI. Piaci Értékelés, Költségelemzés és 2000 Termékes Struktúra (51–60)

A számok **2026-os piaci sávok**, nem árajánlat. Forrás: magyar ügynökségi óradíjak (Netmetro 2026), budapesti senior €40–100/óra, CEE Next.js agency $40–100/óra, Stripe HU 1.5%+85 Ft, Railway usage.

## 51. Ügynökségi ár egy ilyen egyedi Next.js + Stripe + Admin + self-serve logisztikai shopra

Ez **nem** WooCommerce-sablon. 101 API, 47 migráció, RBAC+2FA+CSRF, dual-order sourcing, gamifikáció, 4 nyelv, AI chat, tokenes címmódosítás.

| Szegmens | Sáv (nettó, 2026) |
|----------|-------------------|
| HU kis ügynökség | **18–32 millió Ft** |
| HU prémium / senior team | **28–45 millió Ft** |
| Nyugat-EU ügynökség | **€90 000–180 000** (~36–72 M Ft @ 400 Ft/€) |

Ebbe **nincs** beleszámolva 2000 termék feltöltése.

## 52. Senior Full-Stack óradíj / projektár

| Forma | Óradíj (nettó) |
|-------|----------------|
| HU freelancer | 12–16 ezer Ft |
| HU Bt/Kft 5–20 fő | 16–24 ezer Ft |
| HU ügynökség | 22–30 ezer Ft |
| HU multi | 28–40 ezer Ft |
| Budapest senior agency EUR | €40–100 / óra |
| Nyugat-EU Next.js agency | $80–150 / óra |

Projektben egy ilyen stack **1100–1700 senior óra** (felfedezés, UI, checkout, admin security, teszt, ops). 25 ezer Ft/óra × 1400 óra ≈ **35 M Ft**.

## 53. Kulcsrakész nulláról külső kivitelezővel

Ugyanaz a rendszer, szerződéses garanciával, staginggel, ÁSZF-szinkronnal, 4–8 hét UAT-tal:

- **Alsó (MVP kártya, vékony admin):** 12–18 M Ft — *ez a Gulumen mai mélysége alatt van*
- **Reális (mai feature-paritás):** **25–40 M Ft**
- **Plusz számla + futár API + CMP + 2000 SKU ops:** **38–55 M Ft**

Shopify/Unas sablon **nem** ekvivalens: a sourcing authorize/capture, self-serve cím, gamification ledger egyedi.

## 54. 2000 termék DB- és tárhelyterhelés

Postgresnek **2000 Product sor triviális** (MB-os nagyságrend + indexek). Terhelés a **médián** van:

| Feltételezés | Becslés |
|--------------|---------|
| 5–10 kép/SKU, 200–400 KB/kép | **2–8 GB** origin |
| WebP/AVIF CDN | 1–4 GB serving |
| 360° / GLB 50 SKU-n | +0.5–3 GB |
| `colorImages` JSON | kevés; 2000 × néhány KB |

Railway Postgres + Bunny: 2000 SKU **nem** indokol külön shardot. Szűk keresztmetszet: **lista-query pagináció nélkül**, N+1 like/view, és a Next.js SSR a teljes katalógusra. Indexek `(active, archived)`, `(category, active)` megvannak; full-text kereső **nincs** (ILIKE/kliens szűrő).

Rendelés: 2000 SKU × forgalom — az `Order`/`OrderItem` nő a forgalommal, nem a katalógussal.

## 55. 2000 termék feltöltés / kategória / SEO munkaóra

| Forgatókönyv | Óra / SKU | Összesen |
|--------------|-----------|----------|
| Strukturált CSV + képek készen, 1 nyelv | 4–8 perc | **130–270 óra** |
| Egyedi HU leírás + 3 fordítás + SEO slug + 5 kép + variáció | 20–35 perc | **670–1170 óra** |
| Csak admin UI klikkelés, nincs import | 8–15 perc | **270–500 óra** |

Ügynökségi content team 18 ezer Ft/óra: **2.5–21 M Ft** a minőségtől függően. A repo seedje **35**, mock **68** SKU — az import script (`seed:products`) create-only, nem 2000-es PIM.

## 56. Külső szolgáltatások éves díja (forgalmas 2000 SKU shop)

Alapinfra (forgalom nélkül is):

| Szolgáltatás | Éves (kb.) |
|--------------|------------|
| Railway Pro + 1–2 replica + Postgres | **$400–1 200** (~0.16–0.48 M Ft) |
| Upstash Redis | $0–300 |
| Resend (tranzakciós) | $0–240 (Free → Pro) |
| Bunny CDN + storage | $50–250 |
| Domain + DNS | $15–40 |
| Sentry | $0–312 |
| OpenAI chat (ha él) | $100–1 200 |
| **Alapinfra összesen** | **~$0.6–3.5k / év** |

**Stripe (HU, 2026):** standard EEA kártya **1.5% + 85 Ft** / sikeres charge; prémium EEA magasabb; nemzetközi 3.25% + 85 Ft (+2% FX).

Példa: 50 000 Ft átlag kosár, 20 rendelés/nap, 365 nap ≈ 7 300 charge ≈ **365 M Ft GMV** → Stripe ~ **1.5% × 365 M + 85 × 7300 ≈ 5.5 M + 0.62 M ≈ 6.1 M Ft / év**. A Stripe **dominálja** a változó költséget, nem a Railway.

Napi 500 rendelés ugyanazon 50 eFt-tal: GMV ~9.1 Mrd Ft/év → Stripe ~**140 M Ft/év** — ekkor már acquirer-tárgyalás / Stripe-alternatíva számít, nem a hosting.

## 57. Piaci bekerülési érték, ha nem saját időből épül

| Tétel | Sáv |
|-------|-----|
| Szoftver (mai paritás) | 25–40 M Ft |
| 2000 SKU feltöltés (közepes minőség) | 6–12 M Ft |
| Számla + cookie + futár API | 3–8 M Ft |
| Első év infra + Stripe (közepes forgalom) | 0.5–8 M Ft (forgalomfüggő) |
| **Összesen „ha ügynökség csinálja”** | **35–60 M Ft** + Stripe |

Saját idő: a kódtörténet (százas nagyságrendű feature branch) **több száz–ezer óra** senior munkának felel meg.

## 58. ROI (reselling / e-commerce, fenntartás függvényében)

Fenntartás (kis forgalom): infra 1–3k USD/év + Stripe 1.5%+85 Ft + opcionális 10–20 óra/hó üzemeltetés (250–500 ezer Ft/hó ügynökséggel).

Egyszerűsített:  
`havi hozzájárulás = (árrés% − 1.5% Stripe) × GMV − hosting − munka`

Példa 40% árrés, 10 M Ft/hó GMV:  
Stripe ~0.15–0.2 M; árrés 4 M; hosting ~0.05 M → **~3.7 M Ft/hó** hozzájárulás a beszerzés előtt. A szoftver 35 M Ft-os ügynökségi ára ~**10–15 hónap** alatt térül, ha a GMV tartós. Saját fejlesztésnél a „költség” az elmaradt bér / opportunity cost.

Kockázat: készlet, sourcing laterálás, ÁFA-számla hiánya, MX, chargeback. Az egyedi platform **akkor** ver Shopify-t, ha a sourcing+gamification+self-serve a differenciáló — a 2% Shopify fee vs 0 hosting itt másodlagos a Stripe mellett.

## 59. Skálázás: 10 → 500 rendelés/nap

| Réteg | 10/nap | 500/nap | Korlát |
|-------|--------|---------|--------|
| Postgres | Triviális | Triviális (ha indexelt) | Connection pool; Railway cap |
| Next.js 1 replica | OK | CPU a SSR/admin/kép | Horizontal replica + Redis **kötelező** |
| Stripe webhook | OK | Burst retry | Idempotens CAS van; elevation retry rés fáj |
| Rate-limit memory | OK | **Rossz** több podon | Upstash |
| Cron stuck-payments | Kell | Kritikus | Railway cron kell |
| Címkenyomtatás böngészőből | OK | Fájdalmas | Futár API + tömeges státusz |
| E-mail Resend | OK | Quota | Pro plan |
| Készlet CAS | OK | OK | Postgres row lock |
| 3D/galéria | OK | CDN | Bunny |

500/nap ≈ 6 charge/perc átlag, csúcs 10×. Egy 2 vCPU replica + Redis + 2× webhook concurrency elég a **fizetésre**; a szűk keresztmetszet az **emberi fulfillment** (címke, sourcing beszerzés), nem a 2000 SKU.

Javasolt 500/nap előtt: 2 Railway replica, Redis, PgBouncer/pool, webhook queue (ha a sync side-effect nő), Billingo batch, courier.

## 60. Executive Summary — erősségek, kockázatok, 2000 SKU előtti teendők

**Erősségek**

- Érett egyedi stack: Next 14, Prisma 6, atomi készlet, dual-order (raktár capture + sourcing authorize)
- Stripe aláírás + CAS idempotencia + siker oldali proof-gated finalize-rewards
- Admin: 2FA, RBAC, CSRF, IP allowlist, rejtett slug, audit, approval
- Önkiszolgáló címmódosítás originál snapshot + 🔥 + `printedAt` lock
- `1.dani@gmail.com` ki van zárva a rendelés-notifyból
- Health/migrate-on-start/CI/Semgrep — üzemeltethető Railwayen
- 89 unit teszt a biztonsági magon

**Kockázatok**

- Redis nélkül multi-instance gyenge
- postmaster MX
- Webhook succeeded retry nem emel rendelést
- Nincs számla → HU ÁFA-kockázat
- GA cookie nélkül
- Cron csak akkor él, ha Railway/külső hívja
- by-group enumeráció rate-limit nélkül
- Dokumentáció drift (fizetés-doc Dummy-only)

**2000 termékes indulás előtt (sorrend)**

1. MX + Redis + Railway cron + Sentry  
2. Stripe élő teszt + webhook retry + kosár try/catch  
3. Cookie CMP / GA off + ÁSZF szinkron  
4. Számlázó API  
5. Termékimport (kép CDN, pagináció, SEO slug)  
6. Címke-folyamat próba; futár API ha a volumen nő  
7. Staging kapu, majd master → www  

**Készültség:** szoftver **84%**; 2000 SKU kereskedelmi csomag **68%**. A mag eladható kártyával; a 100% a jogi számla, a fogadó e-mail, a katalógus és a logisztikai automatizmus.

---

*Elemzés a 2026-08-15 `main` kódállapotról. Az éles Railway Variables értékei a repóból nem olvashatók — a 2026-08-09 health minta Redis-t `skipped`-nek mutatta.*
