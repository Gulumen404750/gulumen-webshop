# Sourcing atomi foglalás (maxOrders race condition)

## Változások

- **ProductReservation** tábla: slot / foglalás (RESERVED 15 min → PAID webhooknál, vagy lejár).
- Checkout: **createCheckoutOrders előtt** atomi foglalás (`reserveSourcingSlots`). Ha nincs elég slot → **409** body: `{ "error": "Sold out" }`.
- Fizetés webhook (succeeded): `markReservationsPaidByOrderId(orderId)` – idempotens (már PAID is ok).
- Két párhuzamos request az utolsó slotra: egyik 200 + payment redirect, másik **409 Sold out**.

## Migráció

```bash
npx prisma migrate deploy
# vagy dev: npx prisma migrate dev
```

## Elfogadási kritériumok

1. **Párhuzamos kérés**: két egyidejű POST /api/checkout az utolsó slotra → egyik siker, másik 409 `{ "error": "Sold out" }`.
2. **Webhook idempotencia**: ugyanaz a payment success webhook kétszer → rendelés és reservation státusz nem írja felül (már paid).
3. **Lejárt checkout**: 15 perc múlva a RESERVED foglalás nem számít aktívnak, a slot felszabadul (új checkout foglalhatja).

## Teszt ötlet (párhuzamos slot)

1. Sourcing deal termék maxOrders=1, jelenleg 0 rendelés.
2. Indíts két egyidejű checkout kérést (pl. két terminálból `curl -X POST .../api/checkout` ugyanazzal a kosárral).
3. Várható: egyik 200 + payments, másik 409 `{ "error": "Sold out" }`.
