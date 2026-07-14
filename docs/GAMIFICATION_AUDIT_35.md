# Gamification Audit – 35 kérdés (architektúra válaszok)

*Implementáció alapja: `prisma/schema.prisma`, `src/lib/gamification/*`*

---

## I. Adatbázis és Integritás

### 1. Hol tárolod a User session-t?

**Dual auth** (`src/lib/auth.ts`):
- **Email/jelszó:** saját JWT → `gulumen-session` httpOnly cookie (`jose` HS256, 30 nap)
- **Google:** NextAuth v4 → `next-auth.session-token` cookie

Gamification minden API-n **`resolveSessionUserId()`** → Prisma `User.id` (cuid), nem email.

---

### 2. A PointTransaction tábla írásvédett lesz-e (append-only)?

**Igen – elv.** Nincs `updatedAt`; az app rétegben **tilos UPDATE/DELETE**. Csak `INSERT`.

Audit: `balanceAfter` minden sorban; visszavonás = új `REVERSAL` sor negatív/pozitív `delta`-val.

DB szinten (opcionális később): Postgres trigger tiltja a módosítást.

---

### 3. Hogyan biztosítjuk, hogy a pontszám ne legyen negatív?

Három réteg:
1. **DB CHECK:** `UserPointWallet.balance >= 0`, `PointTransaction.balanceAfter >= 0`
2. **App:** `applyPointDelta()` ellenőrzi `newBalance < 0` → `InsufficientPointsError`
3. **Levonás előtt:** `redeemPointsForCoupon()` `$transaction` + optimistic lock

---

### 4. Milyen constraint van userId + productId kapcsolatra a lájkoknál?

```prisma
@@unique([productId, userId])  // ProductLike
```

FK: `userId` → `User.id` ON DELETE CASCADE. `productId` nincs FK (rugalmas, mock/DB mix miatt).

---

### 5. Hogyan szűrjük ki az „elsődleges” pontszámot?

**Olvasás:** `UserPointWallet.balance` (O(1) cache).

**Ellenőrzés:** `SUM(PointTransaction.delta) WHERE userId = ?` vs wallet → `reconcileUserPoints()`.

**Forrás igazság:** mindig a ledger; wallet csak gyorsítótár.

---

### 6. Szükséges-e PointSnapshot tábla?

**Igen, ajánlott** – implementálva. Napi `(userId, date)` → `balance`, `txCount`.

Használat: admin dashboard, reconciliation cron, nem blokkolja a fő API-t.

---

### 7. Mi a fallback wallet vs ledger eltérésnél?

1. `reconcileUserPoints(userId)` → `{ walletBalance, ledgerSum, match }`
2. Admin script: ledger sum a master → wallet javítás + `ADMIN_ADJUST` tranzakció
3. `lastReconciledAt` jelzi az utolsó ellenőrzést

---

## II. Napi 5 perc logikája (Tracking)

### 8. Milyen esemény indítja az időmérést?

**Route change NEM** – kliens oldali **Page Visibility + focus** timer.

Indul: `visibilitychange === visible` + `document.hasFocus()`.

API: `POST /api/gamification/heartbeat` (következő PR) → `recordBrowseHeartbeat()`.

---

### 9. Hogyan különítjük el az aktív böngészést az üresen hagyott fültől?

Heartbeat csak akkor fogadott, ha:
- `isVisible === true`
- `hasFocus === true`

Háttérben futó tab → `reason: 'inactive_tab'`, nincs increment.

---

### 10. Hogyan kerüljük el a folyamatos POST hívásokat?

- Kliens: **30 mp** batch (`HEARTBEAT_CLIENT_INTERVAL_MS`)
- Szerver: max **90 mp** delta / kérés (`HEARTBEAT_MAX_DELTA_SECONDS`)
- Rate limit: meglévő 60/min/IP + user napi cap a `UserDailyActivity`-ben

---

### 11. Hol tároljuk az aktuális napi aktivitási időt?

**DB:** `UserDailyActivity` (`activeSeconds`, `activityDate` Europe/Budapest).

Kliens: csak helyi timer, **nem** authoritative – szerver számol.

---

### 12. Mi történik több eszközön?

Minden eszköz heartbeat → ugyanaz a `(userId, activityDate)` sor → `activeSeconds` increment.

**Előny:** összeadódik (5 perc hamarabb elérhető).  
**Kockázat:** két eszköz = gyorsabb haladás → max cap `BROWSE_DAILY_TARGET_SECONDS * 2`.

---

### 13. Hogyan validáljuk szerveroldalon a „5 perc” valóságát?

- `deltaSeconds` clamp: 0–90
- Napi összes cap
- `bonusGranted` flag – egyszeri jóváírás / nap
- Idempotency: `browse-5min:{userId}:{date}`

---

### 14. Hogyan akadályozzuk a bot heartbeat spamet?

- Rate limit IP + user
- `gamificationSuspended` flag wallet-en
- Heartbeat csak visible+focus
- Outbox + idempotency (dupla jóváírás lehetetlen)
- Suspicious: >100 heartbeat/nap → auto suspend (következő PR)

---

## III. 10 kedvencelés (Like) rendszer

### 15. A Like createdAt indexelve van?

**Igen** – `@@index([userId, createdAt])`, `@@index([createdAt])`.

---

### 16. Napi limit: éjfél vagy gördülő 24h?

**Budapest éjfél** – `getGamificationDate()` → `UserDailyLikeProgress.progressDate`.

Fix naptári nap, nem gördülő ablak (egyszerűbb UX: „ma még 3 lájk”).

---

### 17. POST /api/likes spam védelem?

- Auth kötelező (`resolveSessionUserId`)
- Rate limit 60/min/IP
- `$transaction` + unique constraint
- `toggleLikeWithGamification()` – atomi

---

### 18. Like majd unlike – visszavonjuk a pontot?

**Napi számláló:** igen, ha `LIKE_UNDO_DECREMENTS_DAILY_COUNT` és bónusz még nem járt.

**Már jóváírt pont:** nem vonjuk vissza (append-only); unlike nem REVERSAL.

---

### 19. Race condition két párhuzamos lájknál?

`prisma.$transaction`:
1. `findUnique` / `create` ProductLike
2. `upsert` UserDailyLikeProgress
3. `count` + Product.likesCount update

Unique `(productId, userId)` → második parallel create → P2002 → no-op.

---

### 20. LikeBonus azonnal vagy async?

**Async outbox:** elérés után `enqueuePointEvent(LIKE_DAILY_BONUS)`.

API válasz gyors; pont jóváírás `processPendingPointEvents()` workerrel.

---

### 21. Hogyan mutatjuk: hány lájknál tart a 10-ből?

API válasz: `{ dailyLikeCount, dailyLikeTarget: 10 }` a like toggle-ból.

Frontend: „7/10 kedvenc ma” progress a headerben vagy profilban.

---

## IV. Kedvezmény és Kupon logika

### 22. A 350–400 pont küszöb statikus vagy dinamikus?

**Konfigurálható:** `REDEEM_THRESHOLD_MIN/MAX/DEFAULT` (`constants.ts`).

Később: `Setting` tábla `gamification.redeem_threshold` kulcs.

---

### 23. Kupon lejárati idő?

**30 nap** beváltástól (`COUPON_VALIDITY_DAYS`) → `Coupon.validUntil`.

---

### 24. Kupon kód kitalálhatatlansága?

`GLM-` + 12 hex char UUID-ból → `GLM-A1B2C3D4E5F6`.

Nem sequential, nem userId alapú.

---

### 25. Pontlevonás + kupon egy $transaction-ben?

**Igen** – `redeemPointsForCoupon()` egy tranzakció:
wallet update → PointTransaction → Coupon create.

---

### 26. Pontlevonás után nem használt kupon?

Kupon `active: true`, `usedCount: 0`, `validUntil` lejár.

Cron: lejárt kupon deaktiválás + opcionális `reverseCouponRedemptionIfUnused()`.

---

### 27. Pontlevonás visszavonható refund esetén?

**Igen** – `REVERSAL` tranzakció + kupon deaktiválás, ha **nem volt felhasználva**.

Ha kupon már felhasznált checkout-on → nincs pont vissza (üzleti szabály).

---

## V. Frontend és UX

### 28. Pontszámláló frissítés?

**SWR/React Query** 60 mp polling bejelentkezve + **mutate** like/heartbeat után.

Nem folyamatos polling (30s elég).

---

### 29. Progress bar adatforrás?

`GET /api/gamification/status` → `{ balance, redeemThreshold, dailyBrowse, dailyLikes }`.

React Query cache + optimistic update like-nál.

---

### 30. Milestone (350+ pont) UX?

**Toast** + opcionális **modal** „Beválthatod kuponra!” – egyszer session-enként (`sessionStorage` flag).

---

### 31. Progress bar animáció nagy adatnál?

CSS `transform: scaleX()` GPU-n; érték 0–1 normalizált, nem animálunk 350 egyedi lépést.

---

### 32. Mobil pontszámláló elhelyezés?

Header badge (mint wishlist count) – koppintás → profil gamification szekció.

Nem overlay a checkout-on.

---

### 33. Offline pontgyűjtés fallback?

Heartbeat queue **localStorage** (`pendingHeartbeats[]`); reconnect → batch küldés.

Szerver idempotency megakadályozza dupla jóváírást.

---

## VI. Üzleti / Biztonság

### 34. Suspicious behavior – kizárás?

`UserPointWallet.gamificationSuspended = true` + `suspendReason`.

Trigger (következő PR): >200 heartbeat/nap, >50 like/óra, IP mismatch pattern.

---

### 35. Audit riport – kupon fogyás?

SQL / admin dashboard:
```sql
SELECT DATE("createdAt"), COUNT(*) 
FROM "PointTransaction" 
WHERE type = 'REDEEM_COUPON' 
GROUP BY 1;
```

+ `Coupon` WHERE `source='gamification'` + `usedCount` vs `active`.

---

## Aszinkron PointTransaction – architektúra

```
[Kliens] heartbeat / 10. like
    ↓ gyors POST (<50ms)
[API Route] validate + DB increment (activity/progress)
    ↓ enqueuePointEvent() – INSERT PointEvent pending
[Response] 202 { queued: true }
    ↓
[after()] vagy Cron /api/cron/process-point-events
    ↓
processPendingPointEvents()
    ↓ applyPointDelta() – wallet + PointTransaction
[Completed] PointEvent.status = completed
```

**Fájlok:**
- `src/lib/gamification/point-event-queue.ts` – outbox
- `src/lib/gamification/point-ledger.ts` – ledger
- `src/lib/gamification/like-gamification.ts` – race-safe likes
- `src/lib/gamification/browse-heartbeat.ts` – 5 perc tracking
- `src/lib/gamification/redeem-coupon.ts` – kupon beváltás

**Példa route (következő PR):**

```typescript
// src/app/api/gamification/heartbeat/route.ts
import { after } from 'next/server'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { recordBrowseHeartbeat, processPendingPointEvents } from '@/lib/gamification'

export async function POST(request: Request) {
  const session = await getSession(request)
  const userId = session ? await resolveSessionUserId(session) : null
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = await recordBrowseHeartbeat({
    userId,
    deltaSeconds: body.deltaSeconds,
    isVisible: body.isVisible,
    hasFocus: body.hasFocus,
  })

  after(async () => { await processPendingPointEvents() })

  return Response.json(result)
}
```

---

## Következő lépések (implementációs sorrend)

1. ✅ Prisma schema + migration SQL
2. ✅ Core lib (`gamification/*`)
3. ⏳ API routes: heartbeat, status, redeem
4. ⏳ Cron: process-point-events
5. ⏳ Frontend: PointsContext, progress UI
6. ⏳ Like route átkötés: `toggleLikeWithGamification()`
7. ⏳ Checkout: szerver oldali gamification kupon validáció
