# Fizetési rendszer – jelenlegi állapot (részletes)

Dokumentum frissítve: 2025.02.13

---

## 1. Áttekintés

A rendszer **egy checkout gomb**, **1–2 rendelés** és **1–2 fizetési tranzakció** modellre épül:

- **Csak raktári termék** → 1 Order (in_stock) + 1 PaymentTransaction (capture)
- **Csak beszerzéses termék** → 1 Order (sourcing) + 1 PaymentTransaction (authorize)
- **Mindkettő** → 2 Order + 2 PaymentTransaction, közös `orderGroupId`

A fizetés provider-független interfészen keresztül megy; jelenleg **csak DummyProvider** van használatban (nincs Stripe a checkout flow-ban).

---

## 1b. Teljes folyamat (lépésről lépésre – minden úgy van, ahogy van)

1. **Kosár** (localStorage): a felhasználó kosárban lévő tételek `productId` + `qty`. A termék típus (`stock` / `sourcing_deal`) a `getProductById()` alapján dönti el, melyik rendelésbe kerül.

2. **Fizetés oldal** (`/fizetes`): egy „Fizetek kártyával” gomb. E-mail kötelező (bejelentkezett user vagy vendég mező). Sourcing_deal csak ACTIVE lehet (időzített akció).

3. **Kattintás** → POST `/api/checkout`:
   - Body: `items` (productId, qty), `customer: { email }`, opcionálisan `isDiscountActive`, `discountPercent`.
   - Backend: rate limit, validáció, termék létezik + sourcing ACTIVE, kosár felosztás in_stock / sourcing, `orderGroupId` generálás, 1 vagy 2 Order létrehozás (`payment_pending`), e-mail mentés, 1 vagy 2 PaymentTransaction (capture / authorize), provider hívás (Dummy → mindig pending), válasz `{ orderGroupId, payments }`.

4. **Frontend válasz**:
   - Ha van redirect payment + `url` → teljes oldal átirányítás az URL-re.
   - Ha client_secret → státusz + 2 s után átirányítás sikerre.
   - Egyébként (Dummy: pending) → „Raktári / Beszerzéses: feldolgozás…” + 2,5 s után átirányítás `/fizetes/siker?order_group_id=<orderGroupId>`.

5. **Siker oldal** (`/fizetes/siker?order_group_id=xxx`): GET `/api/orders/by-group?order_group_id=xxx` → 1 vagy 2 Order. Külön blokk: **Raktári rendelés** (in_stock order id, összeg, státusz), **Beszerzéses rendelés** (sourcing order ugyanígy). Ha valamelyik paid/fulfilled → kosár ürítés, kupon felhasznált, analytics. Polling: ha még nincs minden terminális állapotban, 1,5 s-ként újra lekérdezés (max 8×).

6. **Fizetés eredmény** (valós provider esetén): a provider webhookja hívja POST `/api/payments/webhook` – body: `provider`, `transactionId`, `status` (succeeded / failed / cancelled). A webhook frissíti a PaymentTransaction.status-t, majd:
   - succeeded + capture → Order.status = **paid**
   - succeeded + authorize → Order.status = **sourcing_pending**
   - failed / cancelled → Order.status = **cancelled**

7. **Sourcing rendelés további sorsa** (admin):
   - **Sikeres beszerzés**: POST `/api/admin/sourcing/:orderId/success` (opcionális `x-admin-key`) → provider `captureAuthorizedPayment`, PaymentTransaction → succeeded, Order → **fulfilled**.
   - **Sikertelen beszerzés**: POST `/api/admin/sourcing/:orderId/fail` → provider `cancelAuthorizedPayment`, PaymentTransaction → cancelled, Order → **sourcing_failed**.

8. **Dummy teszt**: a tranzakciók „succeeded” állapotba kerülnek, ha kézzel meghívod a webhookot: POST `/api/payments/webhook`, body `{ "provider": "dummy", "transactionId": "tx_...", "status": "succeeded" }` (a `tx_...` a checkout válasz `payments[].transactionId` mezőjéből).

Semmi nincs megváltoztatva: a fenti leírás csak rögzíti a jelenlegi folyamatot úgy, ahogy van.

---

## 2. Adatmodell

### 2.1 Product (`src/lib/data.ts`)

- **`type`**: `'stock' | 'sourcing_deal'`
- A kosár felosztás és a checkout ezt használja: `sourcing_deal` → sourcing rendelés + authorize, egyéb → in_stock + capture.

### 2.2 Order (`src/lib/orders.ts`)

| Mező | Típus | Leírás |
|------|--------|--------|
| `id` | string | pl. `ord_1739..._abc123` |
| `status` | OrderStatus | lásd alább |
| `items` | OrderItem[] | productId, qty, fulfillmentType, priceHuf, name |
| `subtotalHuf`, `discountHuf`, `totalHuf` | number | |
| `currency` | string | pl. `huf` |
| `createdAt` | string (ISO) | |
| **`orderGroupId`** | string? | Új flow: közös csoport (1 checkout = 1 csoport) |
| **`orderType`** | `'in_stock' \| 'sourcing'`? | Új flow: raktári vs beszerzéses |
| `stripeSessionId`, `paymentIntentId`, `amountPaid`, `currencyPaid`, `paidAt`, `paidWebhookEventId` | opcionális | Régi Stripe flow / webhook |
| `customerEmail` | string? | Vendég e-mail vagy bejelentkezett user |
| `countedForLoyalty`, `refundedAmount`, `refundStatus`, `cancelRequestedAt` | opcionális | Hűség, visszatérítés |

**OrderStatus**:  
`pending` | `paid` | `failed` | `created` | `payment_pending` | `cancelled` | `sourcing_pending` | `sourcing_failed` | `fulfilled`

- Új checkout-ban a rendelések **`payment_pending`**-ként jönnek létre.
- Webhook/Admin után: **paid**, **sourcing_pending**, **fulfilled**, **sourcing_failed**, **cancelled**.

**Tárolás**: `data/orders.json` (fájl; élesben DB kell).

### 2.3 PaymentTransaction (`src/lib/payment-transactions.ts`)

| Mező | Típus | Leírás |
|------|--------|--------|
| `id` | string | pl. `tx_1739..._xyz` |
| `orderId` | string | Kapcsolt rendelés |
| `provider` | string | pl. `dummy` |
| **`mode`** | `'capture' \| 'authorize'` | Azonnali terhelés vs zárolás |
| **`status`** | PaymentTransactionStatus | lásd alább |
| `amount`, `currency` | number, string | |
| `providerRef` | string? | Külső provider referencia |
| `createdAt` | string (ISO) | |

**PaymentTransactionStatus**:  
`created` | `pending` | `succeeded` | `cancelled` | `failed`

**Tárolás**: `data/payment-transactions.json`.

---

## 3. Checkout API – POST /api/checkout

**Fájl**: `src/app/api/checkout/route.ts`

### 3.1 Bemenet (JSON body)

- **`items`**: `{ productId, qty }[]` (min. 1)
- **`customer`**: `{ email, name? }`
- **`isDiscountActive`**, **`discountPercent`**: opcionális (kupon); ha nincs, loyalty kedvezmény e-mail alapján

### 3.2 Backend lépések

1. **Rate limit** ellenőrzés.
2. **Validáció** (zod): items, customer.email.
3. **Termék ellenőrzés**: minden `productId` létezik; ha `sourcing_deal`, akkor **ACTIVE** (időzített akció).
4. **Kosár felosztás** (`splitCartAndComputeTotals`):
   - `product.type !== 'sourcing_deal'` → **in_stock** (OrderItem + subtotal/discount/total)
   - `product.type === 'sourcing_deal'` → **sourcing**
5. **Üres kosár**: ha egyik halmaz sem ad érvényes tételeket → 400.
6. **`orderGroupId`** generálás: `grp_<timestamp>_<random>`.
7. **Rendelések**: `createCheckoutOrders()` – legfeljebb 2 Order (in_stock, sourcing), mind `status: 'payment_pending'`, `orderGroupId`, `orderType` beállítva.
8. **Customer e-mail** mentése mindkét rendeléshez.
9. **Fizetési tranzakciók**:
   - in_stock order → PaymentTransaction **mode: capture**, majd `status: 'pending'`, provider **createCapturePayment**
   - sourcing order → PaymentTransaction **mode: authorize**, majd `status: 'pending'`, provider **createAuthorizationPayment**
10. **Válasz**: `{ orderGroupId, payments }`.

### 3.3 Válasz – payments tömb

Minden elem:  
`orderId`, `orderType` (`in_stock` | `sourcing`), **`mode`** (`capture` | `authorize`), `transactionId?`, **`type`**: `redirect` | `client_secret` | `pending`, és típus szerint:

- **redirect**: `url`
- **client_secret**: `clientSecret`
- **pending**: `message?`

DummyProvider mindig **pending**-et ad (nincs redirect, nincs clientSecret).

---

## 4. Payment Provider réteg

**Fájl**: `src/lib/payment-provider.ts`

### 4.1 Interfész (PaymentProvider)

- **createCapturePayment(params)** → azonnali terhelés (in_stock)
- **createAuthorizationPayment(params)** → zárolás (sourcing)
- **captureAuthorizedPayment({ transactionId })** → zárolt összeg levonása (admin: sikeres beszerzés)
- **cancelAuthorizedPayment({ transactionId })** → zárolás felszabadítása (admin: sikertelen beszerzés)

Params: `transactionId`, `amount`, `currency`, `orderId`, `orderGroupId`, `customer: { email, name? }`.

### 4.2 DummyProvider (jelenlegi)

- **name**: `'dummy'`
- **createCapturePayment** / **createAuthorizationPayment**: nem hív külső API-t; mindig `{ type: 'pending', transactionId, message }`.
- **captureAuthorizedPayment** / **cancelAuthorizedPayment**: mindig `{ success: true }`.
- **Stripe nincs** a checkout flow-ban; később cserélhető pl. StripeProviderre.

Alapértelmezett provider: `getPaymentProvider()` → ha nincs beállítva, **DummyProvider**.

---

## 5. Frontend – fizetés oldal

**Fájl**: `src/app/fizetes/page.tsx`

- **Egy gomb**: „Fizetek kártyával” (`t('payment.payWithCard')`).
- **Ellenőrzések**: e-mail (user vagy vendég mező), érvényes e-mail formátum, sourcing_deal csak ACTIVE.
- **Hívás**: POST `/api/checkout` – body: `items`, `customer: { email }`, `isDiscountActive`, `discountPercent` (ha kupon).
- **Válasz feldolgozás**:
  - Ha van **redirect** payment és `url` → `window.location.href = url`.
  - Ha **client_secret** → státusz kiírás, ~2 s után átirányítás siker oldalra.
  - Egyébként (**pending**, Dummy esetén) → „Raktári / Beszerzéses: feldolgozás…” státusz, ~2,5 s után átirányítás `/fizetes/siker?order_group_id=...`.

Üres kosárnál átirányítás a kosár oldalra.

---

## 6. Siker oldal – /fizetes/siker

**Fájl**: `src/app/fizetes/siker/page.tsx`

### 6.1 Paraméterek

- **`order_group_id`** (új flow): GET `/api/orders/by-group?order_group_id=...` → Order[].
- **`session_id`** (régi Stripe flow): GET `/api/orders/by-session?session_id=...` → egy Order (Stripe session → metadata.orderId).

Ha nincs sem `order_group_id`, sem `session_id` → hibaüzenet.

### 6.2 order_group_id esetén (új flow)

- Lekérdezés: **GET /api/orders/by-group**.
- **Külön megjelenítés**:
  - **Raktári rendelés**: in_stock order – id, totalHuf, státusz (paid / feldolgozás / cancelled / …).
  - **Beszerzéses rendelés**: sourcing order – ugyanígy.
- Ha van **paid** vagy **fulfilled** rendelés → kosár ürítés, kupon „felhasznált”, analytics `trackPurchase`.
- **Polling**: ha még nincs minden terminális állapotban, max 8× 1,5 s különbséggel újralekérdezés.

Végső állapotok: `paid`, `fulfilled`, `cancelled`, `sourcing_failed`.

---

## 7. Webhook – POST /api/payments/webhook

**Fájl**: `src/app/api/payments/webhook/route.ts`

**Body** (általános váz): `provider`, `transactionId`, `status` (`succeeded` | `failed` | `cancelled` | `pending`), `providerRef?`.

**Logika**:

1. PaymentTransaction keresés `transactionId` alapján; ha nincs → `{ received: true }`.
2. **PaymentTransaction.status** frissítése: `succeeded` | `failed` | `cancelled` | `pending`.
3. Kapcsolt Order:
   - **succeeded** + **capture** → `setOrderStatus(orderId, 'paid')`
   - **succeeded** + **authorize** → `setOrderStatus(orderId, 'sourcing_pending')`
   - **failed** vagy **cancelled** → `setOrderStatus(orderId, 'cancelled')`

Dummy teszteléshez pl. kézi POST:  
`{ "provider": "dummy", "transactionId": "tx_...", "status": "succeeded" }`  
(a `tx_...` a checkout válaszban kapott `transactionId`).

---

## 8. Admin – sourcing döntés

### 8.1 Sikeres beszerzés – POST /api/admin/sourcing/:orderId/success

**Fájl**: `src/app/api/admin/sourcing/[orderId]/success/route.ts`

- **Auth**: ha `ADMIN_API_KEY` van, `x-admin-key` header egyezik.
- **Ellenőrzés**: order létezik, `orderType === 'sourcing'`, nincs már `sourcing_failed` / `cancelled`.
- **Authorize tranzakció**: a rendeléshez tartozó `mode === 'authorize'` és nem cancelled/failed.
- **Provider**: `captureAuthorizedPayment({ transactionId })`.
- **Frissítés**: PaymentTransaction → `succeeded`, Order → **`fulfilled`**.

### 8.2 Sikertelen beszerzés – POST /api/admin/sourcing/:orderId/fail

**Fájl**: `src/app/api/admin/sourcing/[orderId]/fail/route.ts`

- Ugyanaz az auth és order/orderType/authorize ellenőrzés.
- **Provider**: `cancelAuthorizedPayment({ transactionId })`.
- **Frissítés**: PaymentTransaction → `cancelled`, Order → **`sourcing_failed`**.
- TODO: e-mail értesítés + kupon a vásárlónak.

---

## 9. Egyéb / régi részek

- **GET /api/orders/by-group** (`src/app/api/orders/by-group/route.ts`): `order_group_id` query → az adott csoport összes Order tömbje.
- **GET /api/orders/by-session** (`src/app/api/orders/by-session/route.ts`): Stripe **session_id** → Stripe API → metadata.orderId → egy Order. A siker oldal régi Stripe flow-hoz használja (`session_id` paraméter).
- **Stripe** (`/api/stripe/create-checkout-session`, `/api/stripe/webhook`): a jelenlegi **egy gombos** checkout **nem** használja; a rendszer a **POST /api/checkout** + **DummyProvider** + **POST /api/payments/webhook** kombinációra épül.

---

## 10. Összefoglaló – mi van meg, mi nincs

| Komponens | Állapot |
|-----------|--------|
| Adatmodell (Order, PaymentTransaction, Product type) | Kész, bővítve orderGroupId, orderType, status, mode |
| POST /api/checkout (felosztás, 1–2 order, 1–2 tx, provider, válasz) | Kész |
| PaymentProvider interfész + DummyProvider | Kész, Stripe nincs a flow-ban |
| Fizetés oldal (1 gomb, redirect / pending, siker átirányítás) | Kész |
| Siker oldal (order_group_id, by-group, raktári / beszerzéses külön) | Kész |
| POST /api/payments/webhook (tx + order status) | Kész |
| Admin sourcing success (capture auth → fulfilled) | Kész |
| Admin sourcing fail (cancel auth → sourcing_failed) | Kész |
| Edge case (csak in_stock / csak sourcing / mindkettő) | Kész, backend validációval |
| Stripe integráció (checkout) | Nincs; régi by-session/create-checkout-session megmaradt, de az új flow nem használja |
| Éles tárolás (DB) | Nincs; orders + payment-transactions fájlban (data/*.json) |

A fizetési rendszer jelenlegi állapota: **működő váz DummyProviderrel**, egy gombos checkout, 1–2 rendelés, 1–2 tranzakció, webhook + admin sourcing döntés. Stripe (vagy más provider) később a PaymentProvider implementáció cseréjével adható hozzá.
