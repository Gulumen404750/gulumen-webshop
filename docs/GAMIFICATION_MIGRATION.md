# Gamification – migrációs terv

## Összefoglaló

| Lépés | Parancs / tevékenység | Környezet |
|-------|----------------------|-----------|
| 1 | Schema review | dev |
| 2 | `npx prisma migrate dev --name gamification_points` | local |
| 3 | Teszt: `npx prisma migrate deploy` dry-run | staging |
| 4 | Railway deploy → `start.js` automatikus `migrate deploy` | production |
| 5 | Backfill wallet (migration SQL automatikus) | production |
| 6 | Cron: `process-point-events` + napi snapshot | production |

## Új táblák

| Tábla | Szerep |
|-------|--------|
| `UserPointWallet` | Cache-elt egyenleg + optimistic lock (`version`) |
| `PointTransaction` | Append-only főkönyv (forrás igazság) |
| `PointEvent` | Outbox – async worker |
| `PointSnapshot` | Napi összesítő (dashboard / reconciliation) |
| `UserDailyActivity` | 5 perc böngészés / nap |
| `UserDailyLikeProgress` | 10 kedvenc / nap |

## Módosított táblák

| Tábla | Változás |
|-------|----------|
| `ProductLike` | `countsForDailyBonus`, index `(userId, createdAt)` |
| `Coupon` | `userId`, `source`, `pointTransactionId` |

## DB constraint-ek (integritás)

```sql
UserPointWallet.balance >= 0
PointTransaction.delta <> 0
PointTransaction.balanceAfter >= 0
ProductLike UNIQUE (productId, userId)
PointTransaction UNIQUE (idempotencyKey)
PointEvent UNIQUE (idempotencyKey)
```

## Rollback terv

1. **Előtte:** Railway Postgres snapshot / manual backup
2. **Rollback migration:** új migráció a táblák `DROP` + oszlopok eltávolítása (nem automatikus)
3. **Adatvesztés:** `PointTransaction` append-only – rollback törli a pont history-t

**Ajánlás:** staging-en először futtasd a migrációt éles adatmásolattal.

## Backfill lépések (éles deploy után)

1. Migration automatikusan létrehoz `UserPointWallet`-et minden meglévő `User`-nek (balance=0)
2. Opcionális: régi localStorage kuponok **nem** migrálódnak – tiszta lap
3. `reconcileUserPoints(userId)` admin script később

## Cron / worker (Railway)

Új route (következő PR):

```
GET /api/cron/process-point-events
Authorization: Bearer CRON_SECRET
→ processPendingPointEvents()
→ upsertDailyPointSnapshot() batch
```

Ütemezés: **minden 1 perc** (outbox), **napi 00:05 Europe/Budapest** (snapshot).

## Kockázatok

| Kockázat | Mitigáció |
|----------|-----------|
| Wallet vs ledger eltérés | `reconcileUserPoints()` + napi cron |
| Outbox backlog | batch worker + `maxAttempts` |
| Párhuzamos like | `$transaction` + unique constraint |
| Párhuzamos pontírás | optimistic lock + idempotencyKey |

## Lokális futtatás

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```
