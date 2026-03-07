# Kérdések AINAK – LICIT/SOURCING „BEFAGYASZTÁS” (HOLD) FLOW

## 1. Most a sourcing termékeknél HOLD vagy azonnali charge?

**HOLD (manual capture).** A sourcing rendelést a **`createAuthorizationPayment`** indítja (zárolás), nem a `createCapturePayment`. A későbbi CAPTURE csak admin/worker jelzésre történik.

---

## 2. Melyik endpoint indítja a sourcing fizetést?

A **`/api/checkout`** indítja. A frontend (`src/app/fizetes/page.tsx`) minden fizetéshez (készlet + sourcing) ezt hívja: `fetch('/api/checkout', …)`.

---

## 3. Sourcingra is a /api/checkout megy? Vagy külön /api/stripe/create-checkout-session?

- **Sourcingra is a `/api/checkout`** megy; a frontend nem hívja a `/api/stripe/create-checkout-session`-t.
- **Fontos:** Ne legyen olyan útvonal, ami foglalás nélkül indít sourcing fizetést. A `/api/stripe/create-checkout-session` **nincs** foglalással (reserveSourcingSlots) – ha később sourcingra használnátok, ott is kellene a foglalás, vagy **sourcingot csak a `/api/checkout`-on keresztül indítani**.

---

## 4. A reserveSourcingSlots(...) garantáltan lefut a HOLD előtt?

**Igen.** A sorrend:

1. Validáció (termék, timed status)
2. **`reserveSourcingSlots(...)`** → ha nincs elég slot: **409 „Sold out”**, a handler visszatér, **nem indul el sem payment, sem Stripe**
3. `createCheckoutOrders`
4. `linkReservationsToOrder`
5. `createAuthorizationPayment` (HOLD) / `createCapturePayment` (készlet)

Tehát ha elfogyott a slot → 409, és nem indul el a Stripe/payment flow.

---

## 5. Milyen Order státuszokat használunk sourcingnál? Státusz-lánc

**Sikeres ág (sorban):**

| Státusz            | Jelentés |
|--------------------|----------|
| `payment_pending`  | Rendelés létrejött, HOLD még nincs beküldve / folyamatban |
| `sourcing_pending`| HOLD sikerült (webhook: authorization succeeded) |
| `fulfilled`        | Admin „megnyertem” → CAPTURE megtörtént (végleges terhelés) |

**Sikertelen ág:**

| Státusz           | Jelentés |
|-------------------|----------|
| `sourcing_failed`| Admin „nem nyertem meg” → hold cancel, slot felszabadul |
| `cancelled`       | Webhook: payment failed/cancelled, vagy vevő megszakította |

Összevetve a kért elnevezésekkel:  
`payment_pending` ≈ PENDING_HOLD, `sourcing_pending` ≈ HOLD_OK / SOURCING_PENDING, `fulfilled` ≈ CAPTURED/PAID, `sourcing_failed` + `cancelled` ≈ CANCELED ág.

---

## 6. Mikor történik a CAPTURE?

- **Nem** webhookból automatikusan.
- **Csak** akkor, amikor az admin/worker jelzi, hogy „megnyertem és készleten van”:  
  **POST `/api/admin/sourcing/:orderId/success`** (x-admin-key) → ez hívja a `captureAuthorizedPayment`-et, majd order → `fulfilled`.

---

## 7. Van cancel út? Stripe hold cancel + reservation CANCELED?

**Igen.**

- **Admin „nem nyertem meg”:**  
  **POST `/api/admin/sourcing/:orderId/fail`** → `cancelAuthorizedPayment` (Stripe hold felszabadítása) → **`markReservationsCanceledByOrderId(orderId)`** → reservation CANCELED → slot felszabadul → order → `sourcing_failed`.
- **Webhook (failed/cancelled):**  
  Ha a tranzakció módja `authorize`, akkor **`markReservationsCanceledByOrderId(order.id)`** → order → `cancelled`. Így a vevőnél is felszabadul a slot.

---

## 8. Idempotens a capture/cancel?

**Igen.**

- **Success (capture):**  
  Ha order már `fulfilled` vagy `paid` → 200 + `{ success: true, orderId, status }` (nem hívjuk újra a capture-t).
- **Fail (cancel):**  
  Ha order már `sourcing_failed` → 200 + `{ success: true, orderId, status: 'sourcing_failed' }`.  
  Ha már `fulfilled`/`paid` → 400 („Order already captured”).  
  A `markReservationsCanceledByOrderId` és a provider `cancelAuthorizedPayment` hívása is úgy van használva, hogy dupla kattintás / dupla webhook ne okozzon dupla levonást vagy hibát.

---

## 9. Reservation státusz és lejárat HOLD mellett

- **RESERVED:** max **15 perc** (checkout után, HOLD előtt). Ha 15 perc alatt nincs HOLD siker, a slot nem számít aktívnak (`expiresAt` alapján), és felszabadul.
- **HOLD után:** a webhook (authorization succeeded) **PAID**-re állítja a reservationt. A slot ezután „foglalt”, amíg admin nem capture vagy cancel.
- **Banki (Stripe) autorizáció:** általában **~7 napig** tarthat; utána a bank/Stripe felszabadítja, ha nem volt capture/cancel.
- **Ha a hold lejár, de még nem nyerted meg:**  
  - Stripe oldalon a zárolás automatikusan lejár.  
  - Nálunk: ha a **webhook** jelzi a cancelled/expired állapotot, akkor **`markReservationsCanceledByOrderId`** + order `cancelled` → slot felszabadul.  
  - Ha nincs ilyen webhook, érdemes cron vagy külön „authorization expired” webhook kezelésre felszabadítani a reservationt (CANCELED) és az order státuszt (`sourcing_failed`/`cancelled`) – ez későbbi bővítés lehet.

---

## 10. Készletes termékeknél marad az azonnali fizetés?

**Igen.** Két külön út:

- **Készlet (in_stock):** `createCapturePayment` → azonnali charge (capture).
- **Sourcing:** `createAuthorizationPayment` → HOLD → későbbi CAPTURE (csak admin success után).

---

## 11. Két teszt bizonyítékkal

### Teszt 1: Párhuzamos sourcing checkout, utolsó slot

- **Cél:** Egyik kérés 200 + payment redirect, a másik 409 „Sold out”.
- **Előkészítés:** Egy sourcing deal, `maxOrders = 1`, jelenleg 0 aktív foglalás/rendelés.
- **Lépések:**  
  - Indíts két egyidejű **POST /api/checkout** kérést ugyanazzal a kosárral (pl. két terminál/script).  
  - Body: `{ items: [{ productId: "<sourcing-termék-id>", qty: 1 }], customer: { email: "a@b.c" }, ... }`
- **Elvárás:**  
  - Egyik válasz: **200**, `payments` tömb, redirect URL (vagy client_secret).  
  - Másik válasz: **409**, body: `{ "error": "Sold out" }`.

### Teszt 2: Sourcing „nem nyertem meg” → hold cancel → vevőnél felszabadul

- **Cél:** Admin fail → Stripe hold cancel, reservation CANCELED → ugyanaz a termék újra rendelhető (slot felszabadul).
- **Előkészítés:** Egy sourcing rendelés HOLD-dal, order `sourcing_pending`, a termékre 1 slot foglalt (reservation PAID).
- **Lépések:**  
  1. **POST `/api/admin/sourcing/:orderId/fail`** (x-admin-key: ADMIN_API_KEY).  
  2. Ellenőrizd: order státusz → `sourcing_failed`; a termékhez tartozó reservation(ek) → `CANCELED`.  
  3. Új **POST /api/checkout** ugyanazzal a termékkel (ugyanaz a slot) → **200** (siker), nem 409.
- **Elvárás:** Slot felszabadul, másik vevő ugyanarra a slotra tud checkoutolni.
