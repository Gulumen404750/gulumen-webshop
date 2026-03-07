# Indulás előtti “túléli-e?” tesztek – lefuttatás és bizonyíték

Alap URL (dev): `http://localhost:3000`

---

## 1) Login brute force / rate limit

**Cél:** Brute force ne menjen át.

**Limit:** 10 hibás kísérlet / 10 perc / IP (utána 429). Sikeres login nullázza a számlálót.

### Curl parancsok (PowerShell)

```powershell
# 1–10: mind 401 (hibás e-mail/jelszó)
1..10 | ForEach-Object {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"wrong@example.com","password":"wrong"}' -UseBasicParsing -ErrorAction SilentlyContinue
  Write-Host "Attempt $_ : $($r.StatusCode) - $($r.Content)"
}

# 11. kérés: 429 (Too many login attempts)
$r11 = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"wrong@example.com","password":"wrong"}' -UseBasicParsing -ErrorAction SilentlyContinue
Write-Host "Attempt 11 (expect 429): $($r11.StatusCode) - $($r11.Content)"
```

Egyenként (curl, ha van):

```bash
# Hibás login 10× (mind 401)
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@example.com","password":"wrong"}'
done

# 11. kérés → 429, body: {"error":"Too many login attempts. Try again later."}
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"wrong"}'
```

**Elvárt:**
- 1–10: `401`, body pl. `{"error":"Hibás e-mail vagy jelszó"}`
- 11+: `429`, body: `{"error":"Too many login attempts. Try again later."}`

**Sikeres login után reset:** Ha sikeresen bejelentkezel (érvényes user), utána 1–2 hibás login még 401 (nem 429). A kód: `loginRateLimitRecordSuccess` törli az IP bejegyzést.

**Log bizonyíték:** A szerver logban (pino) megjelenik: `"Login rate limit exceeded"` (logger.warn a `login-rate-limit.ts`-ben).

---

## 2) Sourcing oversell / maxOrders race (utolsó slot)

**Cél:** 1 slotra 2 párhuzamos kérés → csak egyik 200/201, másik 409 Sold out. DB-ben csak 1 aktív (RESERVED vagy PAID) foglalás.

**Előfeltétel:** Termék, ahol `maxOrders = 1` VAGY már (maxOrders − 1) foglalás van, és 2 párhuzamos checkout ugyanarra a termékre.

**Checkout body példa (sourcing, 1 db):**  
Teszttermék `sd-race-1` (maxOrders: 1) – `scripts/test-2-sourcing-race.ps1` ezt használja alapból. Vagy `TEST_PRODUCT_ID=sd-race-1` környezeti változó.

```bash
# Két párhuzamos POST /api/checkout (ugyanaz a body)
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"PRODUCT_ID","qty":1}],"customer":{"email":"a@test.com","name":"A"}}' &
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"PRODUCT_ID","qty":1}],"customer":{"email":"b@test.com","name":"B"}}' &
wait
```

**Elvárt:** 1× 200 (body: orderGroupId, payments), 1× 409 body: `{"error":"Sold out"}`.

**DB bizonyíték:**  
`ProductReservation` tábla: a megadott `productId`-ra csak 1 sor legyen RESERVED vagy PAID (a többi ne legyen ugyanarra a termékre aktív).

```sql
SELECT id, "productId", status, "expiresAt", "orderId"
FROM "ProductReservation"
WHERE "productId" = 'sd-race-1'
ORDER BY "createdAt" DESC;
```

---

## 3) Reservation lejárat / cleanup

**Cél:** 15 perc után a foglalás ne számítson aktívnak; új foglalás engedélyezett.

**Lépések:**
1. Indíts checkoutot egy sourcing termékre (ne fejezd be a fizetést).
2. Várj 16 percet (a kódban `expiresAt` = 15 perc).
3. Ugyanarra a termékre próbálj új checkoutot (ugyanazzal vagy másik e-maillel).

**Elvárt:** Az első checkout létrehoz egy RESERVED foglalást. 15 perc után a `countActiveReservations` már nem számolja (mert `expiresAt > now` hamis), így új foglalás engedélyezett. Ideális: EXPIRED státusz, vagy a count logika nem számolja a lejárt RESERVED-et (jelenleg a count logika: csak RESERVED + expiresAt > now vagy PAID).

**DB:**  
- Lejárt után: a régi sor vagy EXPIRED (ha lesz cleanup job), vagy továbbra is RESERVED de `expiresAt < now` → a count lekérdezés 0 aktívat ad.
- Új foglalás után: új RESERVED sor jön létre.

```sql
SELECT id, "productId", status, "expiresAt", "createdAt"
FROM "ProductReservation"
WHERE "productId" = 'sd-race-1'
ORDER BY "createdAt" DESC;
```

---

## 4) Webhook idempotencia (dupla event)

**Cél:** Ugyanaz a “payment succeeded” 2× (pl. Stripe CLI replay) → mindkét hívás 200/204, nincs dupla könyvelés, `markReservationsPaidByOrderId` nem csinál duplát.

**Stripe webhook:**  
- `order.status === 'paid'` vagy `order.paidWebhookEventId === event.id` → azonnal return 200, nem hív `setOrderPaid` újra.
- Ha mégis lefutna: `setOrderPaid` idempotens (ugyanazt az orderId+eventId-t nem írja újra).
- `markReservationsPaidByOrderId(orderId)` csak `status = 'RESERVED'` sorokat állítja PAID-ra; második híváskor 0 sor frissül → idempotens.

**Payments webhook** (`/api/payments/webhook`):  
- Nincs event-id, de `markReservationsPaidByOrderId` ugyanígy idempotens (csak RESERVED → PAID).

**Teszt:** Stripe CLI-vel ugyanazt az eseményt 2× futtatni, vagy mock body-vel 2× POST. Elvárt: mindkét válasz 200, DB-ben order egyszer paid, reservationek egyszer PAID.

**Log + DB:** Order `paidWebhookEventId` beállítva; ProductReservation státuszok egyszer PAID-ra váltva, nincs extra sor.

---

## 5) Kerülőút kizárása (scope)

**Cél:** Sourcing fizetés csak foglalás után induljon (nincs foglalás nélküli checkout).

**Endpointok, amelyek checkoutot / fizetést indítanak:**
- `POST /api/checkout` – egyetlen hely, ahol checkout és Stripe session / PaymentIntent indul.

**Bizonyítás a kódból:**  
`src/app/api/checkout/route.ts`:  
- Először `reserveSourcingSlots(...)` hívódik (sourcing itemekre).  
- Ha nincs hely: `SoldOutError` → 409.  
- Csak ezután jön `createCheckoutOrders`, majd `getPaymentProvider().createCapturePayment` / `createAuthorizationPayment`.  
→ Sourcing esetén mindig fut a `reserveSourcingSlots` a Stripe session / PaymentIntent létrehozása előtt. Nincs olyan endpoint, ami Stripe-ot indítana sourcing nélkül a checkout flow-on kívül.

---

## 6) HOLD → CAPTURE / CANCEL terv (licit/sourcing befagyasztás)

**Kérdések:**  
- Manual capture (HOLD) lesz-e?  
- Mikor capture, mikor cancel?  
- Milyen order státusz lánc van rá?

**Jelen kód:**  
- Sourcing: `createAuthorizationPayment` (authorize/hold), in_stock: `createCapturePayment`.  
- Order státuszok: `sourcing_pending` (authorize után), majd SOURCING_WON / IN_STOCK után capture, SOURCING_FAILED esetén cancel.

**Elvárt:**  
- CAPTURE csak SOURCING_WON / IN_STOCK után.  
- SOURCING_FAILED → CANCEL HOLD.  
- A `markReservationsCanceledByOrderId` már szerepel a payments webhook-ban (failed/cancelled + authorize mód).

---

## Összefoglaló (kitöltendő a tesztek után)

- [ ] **1 – Login rate limit:** 10 hibás → 429, body és log “Login rate limit exceeded” ✓
- [ ] **2 – Sourcing oversell:** 1× 200, 1× 409, DB-ben 1 aktív reservation ✓
- [ ] **3 – Lejárat:** 15 perc után új foglalás engedélyezett, count/EXPIRED ok ✓
- [ ] **4 – Webhook idempotencia:** Dupla event → 200+200, nincs dupla könyvelés ✓
- [ ] **5 – Scope:** Csak /api/checkout indít fizetést, sourcingnál előbb reserve ✓
- [ ] **6 – HOLD terv:** Dokumentált (CAPTURE/CANCEL, order státuszok) ✓

**További kérdések (IP proxy, cleanup, race párhuzamosság):** lásd `docs/TESZT_EREDMENYEK_OSSZEFOGLALO.md` – 1) IP kinyerés proxy mögött, 2) nincs cleanup job (sorok maradnak), 3) Start-Job = valódi concurrency, PS 7+ USE_PARALLEL=1.

Végeredmény mondat:

- **“A fenti 1–5 tesztek lefutottak és mind PASS”**  
vagy  
- **“X teszt FAIL, javítás folyamatban: …”**
