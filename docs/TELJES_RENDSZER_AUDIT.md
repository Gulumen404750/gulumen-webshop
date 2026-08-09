# Teljes rendszer audit – Gulumen webshop

Utolsó frissítés: 2026-08-09  
Commit bázis: `main` (typecheck Exit 0, éles health ellenőrzéssel)

---

## 1. Összefoglaló

Az éles rendszer **üzemkész**. A legutóbbi fejlesztési ciklusok (szerveroldali kedvezmény-validáció, webhook idempotencia, auth fail-fast, atomi készlet, Railway host binding, Prisma migrációk) a kódbázisban és az éles health végpontokon **igazolva**.

Független audit alapján két **P1** hibát a ciklus során javítottunk:

1. Fizetés `failed` / `cancelled` webhook után az in-stock készlet nem állt vissza.
2. Checkout a lejárt/inaktív akcióárat (`discountPriceHuf`) is alkalmazta, ha a mező kitöltött volt.

---

## 2. Eddigi beavatkozások – ellenőrzés

| Állítás | Státusz | Bizonyíték |
| --- | --- | --- |
| Szerveroldali kedvezmény-validáció (kliens `discountPercent` / `isDiscountActive` ignorálva) | **CONFIRMED** | `src/app/api/checkout/route.ts`, `src/lib/checkout.ts` |
| Webhook signature + soft idempotencia (`paidWebhookEventId`, rewards claim) | **PARTIAL → javítva stock restore** | Stripe `constructEvent`; generic secret; cancel ág most `cancelPendingOrderWithStockRestore` |
| `JWT_SECRET` / `NEXTAUTH_SECRET` fail-fast productionben | **CONFIRMED** | `scripts/start.js` + `scripts/bootstrap-auth-env.cjs` (`exit 1` ha egyik sincs ≥16 char) |
| Régi `src/lib/outbox.ts` eltávolítva | **CONFIRMED** | Modul nincs; gamification `PointEvent` outbox szándékosan megmaradt |
| Prisma migrációk (30) | **CONFIRMED** | `prisma/migrations/*` – 30 mappa |
| Atomi készletcsökkentés checkoutnál | **CONFIRMED** | `src/lib/inventory.ts` `decrementStockAtomic` + `createCheckoutOrders` tranzakció |
| Railway `0.0.0.0` + `PORT` | **CONFIRMED** | `scripts/start.js`; `railway.json` healthcheck: `/api/health/live` |
| Env: `DATABASE_URL`, app URL-ek | **CONFIRMED (éles ready)** | `/api/health/ready` → `db: true` |

---

## 3. Komponens-szintű audit (éles + kód)

| Komponens | Státusz | Megjegyzés |
| --- | --- | --- |
| TypeScript (`npm run typecheck`) | **OK** | `tsc --noEmit` Exit 0 |
| Next.js éles | **ONLINE** | `https://www.gulumen.com/api/health` → 200 `live` |
| Postgres | **ONLINE** | `/api/health/ready` → `{ status: "ready", db: true, redis: "skipped" }` |
| Redis / Upstash | **SKIPPED** | Memory fallback rate-limit + idempotency; multi-instance alatt gyengébb |
| Auth bootstrap | **OK** | Production start fail-fast; build-time kivétel |
| Sentry | **WIRED, DSN nélkül** | `sentry.*.config.ts` + `withSentryConfig` ha `SENTRY_DSN` van |
| Healthcheck | **OK** | Liveness: `/api/health`, `/api/health/live`; readiness: `/api/health/ready` |

### Éles minta (2026-08-09)

```json
// GET /api/health → 200
{ "status": "live", "ts": 1786277806983 }

// GET /api/health/ready → 200
{ "status": "ready", "db": true, "redis": "skipped" }
```

---

## 4. Architektúra

```
[ KLIENS / BÖNGÉSZŐ ]
       │
       ▼ HTTPS https://www.gulumen.com
[ RAILWAY ROUTER ]
       │
       ▼ 0.0.0.0 : PORT
[ NEXT.JS APP (gulumen-webshop) ]
   ├── Auth (NextAuth / JWT fail-fast bootstrap)
   ├── Health (/api/health, /live, /ready)
   ├── Checkout (szerverárak, atomi stock, Idempotency-Key)
   ├── Payments webhook (Stripe signature / PAYMENTS_WEBHOOK_SECRET)
   └── Prisma ORM
       │
       ▼ DATABASE_URL
[ POSTGRESQL ]
```

Opcionális: Upstash Redis (rate-limit + checkout idempotency multi-instance).

---

## 5. E ciklusban javított P1 tételek

### 5.1 Készlet visszaírás failed/cancelled webhooknál

**Probléma:** `applyTransactionOutcome` cancel ága csak authorize reservationt törölt; capture/in-stock rendelésnél a checkoutkor levont stock beragadt, mert a stuck-cleanup csak `payment_pending`-et néz – a rendelés viszont már `cancelled` lett.

**Javítás:** `cancelPendingOrderWithStockRestore()` (`src/lib/stuck-payments.ts`) – CAS `payment_pending → cancelled` + atomi stock restore; a payments webhook ezt hívja.

### 5.2 Akcióár csak aktív sale ablakban

**Probléma:** `resolveCartLines` mindig `discountPriceHuf ?? priceHuf` – lejárt akciónál undercharge.

**Javítás:** `isSaleActive(product)` ellenőrzés a fő checkout pathen és a legacy Stripe create-checkout-session route-on; vitest lefedés.

---

## 6. Fennmaradó kockázatok

| Súlyosság | Tétel | Ajánlás |
| --- | --- | --- |
| P1 | PaymentTransaction fájl/memória store – multi-instance gyenge | Postgres tábla + unique constraint |
| P1 | Redis nélkül rate-limit/idempotency process-lokális | Upstash beállítása élesben |
| P2 | Legacy `/api/stripe/create-checkout-session` még él (nincs stock decrement) | Kikapcsolni / 410 |
| P2 | `setOrderPaid` nem status-CAS | `updateMany` where `payment_pending` |
| P2 | Secret összehasonlítás `!==` (admin/webhook) | `timingSafeEqual` |
| P2 | CSP `unsafe-inline` / `unsafe-eval` | Fokozatos szigorítás |

---

## 7. Roadmap (skálázás / üzemeltetés)

1. **Redis:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → `redis: skipped` megszűnik; ready check pingel.
2. **Staging:** külön Railway környezet + branch az élestől elkülönített tesztekhez (`dynamic-perfection` helyett).
3. **Sentry:** `SENTRY_DSN` (+ opcionálisan `NEXT_PUBLIC_SENTRY_DSN`) beállítása – a kód már bekötve; 5xx / unhandled exception riasztás.
4. **PaymentTransaction DB migráció** multi-instance megbízhatósághoz.

---

## 8. Gyors ellenőrzőlista élesítés után

- [ ] `GET /api/health/live` → 200
- [ ] `GET /api/health/ready` → `db: true`
- [ ] `JWT_SECRET` vagy `NEXTAUTH_SECRET` ≥ 16 karakter
- [ ] `DATABASE_URL` Postgres reference
- [ ] `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` = `https://www.gulumen.com`
- [ ] Stripe: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- [ ] (Ajánlott) Upstash Redis + `SENTRY_DSN`
