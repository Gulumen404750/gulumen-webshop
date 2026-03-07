# Indulás előtti tesztek – eredmények összefoglaló

## Futtatási útmutató

1. **Teszt 1 – Login rate limit**  
   - Indítsd a dev szervert: `npm run dev`  
   - Futtasd: `powershell -ExecutionPolicy Bypass -File scripts/test-1-login-rate-limit.ps1`  
   - Opcionálisan log fájlba: `$env:LOG_FILE="log-teszt1.txt"; .\scripts\test-1-login-rate-limit.ps1`  
   - A szerver konzolban (pino) keress: **"Login rate limit exceeded"**

2. **Teszt 2 – Sourcing race**  
   - `DATABASE_URL` legyen beállítva, szerver fusson.  
   - Futtasd: `powershell -ExecutionPolicy Bypass -File scripts/test-2-sourcing-race.ps1`  
   - Elvárt: 1× HTTP 200, 1× HTTP 409 body "Sold out".  
   - DB: `SELECT * FROM "ProductReservation" WHERE "productId" = 'sd-race-1';` → csak 1 aktív (RESERVED vagy PAID).

3. **Teszt 3 – Lejárat**  
   - Manuális: checkout sourcingra (ne fizess), várj 16 percet, új checkout ugyanarra a termékre.  
   - Count logika: `reservations.ts` – csak `RESERVED` + `expiresAt > now` vagy `PAID` számít aktívnak → 15 perc után a régi foglalás nem blokkol.

4. **Teszt 4 – Webhook idempotencia**  
   - Stripe: `paidWebhookEventId === event.id` vagy `order.status === 'paid'` → 200, nem fut újra `setOrderPaid` / `markReservationsPaidByOrderId`.  
   - `markReservationsPaidByOrderId`: csak `status = 'RESERVED'` → PAID, második híváskor 0 sor frissül.  
   - Stripe CLI replay vagy dupla POST → mindkét válasz 200, DB változatlan.

5. **Teszt 5 – Scope (kód audit)**  
   - **Egyetlen checkout endpoint:** `POST /api/checkout` (`src/app/api/checkout/route.ts`).  
   - Sourcingnál **mindig előbb** fut `reserveSourcingSlots` (sor ~186–198), **utána** `createCheckoutOrders` és `provider.createAuthorizationPayment` / `createCapturePayment`.  
   - Nincs olyan API, ami Stripe session-t indítana sourcing termékre foglalás nélkül → **kerülőút nincs**.

6. **Teszt 6 – HOLD → CAPTURE/CANCEL**  
   - Sourcing: `createAuthorizationPayment` (hold).  
   - Order: `sourcing_pending` (authorize után).  
   - CAPTURE: csak SOURCING_WON / IN_STOCK után (admin/sourcing success flow).  
   - CANCEL: SOURCING_FAILED vagy payment failed/cancelled → `markReservationsCanceledByOrderId` (payments webhook).

---

## Curl – Teszt 1 (login rate limit)

```bash
# 10× hibás login (mind 401)
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"wrong@example.com\",\"password\":\"wrong\"}"
done

# 11. → 429
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"wrong@example.com\",\"password\":\"wrong\"}"
# Elvárt: {"error":"Too many login attempts. Try again later."}  + HTTP 429
```

**Log bizonyíték:** Szerver log (pino): `"msg":"Login rate limit exceeded"` (és `"ip": "..."`).

---

## Végeredmény (kitöltendő a tesztek lefuttatása után)

- **Ha minden teszt PASS:**  
  ✅ **"A fenti 1–5 tesztek lefutottak és mind PASS."**

- **Ha valamelyik FAIL:**  
  ❌ **"X teszt FAIL, javítás folyamatban: [rövid indok]."**

---

### Jelen állapot (kód alapján)

| # | Teszt            | Implementáció / Megjegyzés |
|---|------------------|----------------------------|
| 1 | Login rate limit | 10 failed/10 min, 429 + message, success reset. Log: "Login rate limit exceeded". |
| 2 | Sourcing race    | reserveSourcingSlots tranzakcióban, maxOrders check, SoldOutError → 409. Teszttermék: sd-race-1 (maxOrders=1). |
| 3 | Lejárat          | Aktív = RESERVED (expiresAt>now) vagy PAID. 15 perc után count 0, új foglalás engedélyezett. (EXPIRED státusz opcionális cleanup jobbal.) |
| 4 | Idempotencia     | Stripe: event.id + order.paidWebhookEventId; setOrderPaid idempotens; markReservationsPaidByOrderId csak RESERVED→PAID. |
| 5 | Scope            | Csak /api/checkout indít fizetést; sourcingnál reserve → orders → payment. |
| 6 | HOLD terv        | authorize → sourcing_pending; capture only on SOURCING_WON/IN_STOCK; cancel + markReservationsCanceledByOrderId on fail. |

A tényleges **PASS** igazoláshoz futtasd a 1–2 (és opcionálisan 3–4) teszteket a saját környezetedben, és add hozzá a log/DB kivonatot ehhez a dokumentumhoz.

---

## Kérdések és válaszok

### 1) IP felismerés proxy mögött (rate limit)

**Kód:** `src/lib/login-rate-limit.ts` – `getClientId(request)`:
- `X-Forwarded-For` → a **lista első eleme** (balról = „legelső” proxy által hozzáadott, gyakran a valódi kliens IP)
- ha nincs: `X-Real-IP`
- ha nincs: `'unknown'`

**Prod mögött (Cloudflare / Nginx / Vercel):**
- **Vercel:** Beállítja az `x-forwarded-for` és `x-real-ip` értékét (a kliens IP-vel). A kód jól kinyeri a kliens IP-t, **ha** a platform ezeket felülírja / megbízhatóan állítja.
- **Nginx:** Általában `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` (hozzáfűzi a kliens IP-t). Az első elem a kliens, ha nincs más proxy előtte.
- **Cloudflare:** `CF-Connecting-IP` a valódi kliens; `X-Forwarded-For` is beállítva. Ha a szerver **csak** X-Forwarded-For első elemét nézi, és Cloudflare előtte overwrite-eli, akkor jó. Ha a kérés közvetlenül érkezik (nincs proxy), a kliens **hamisíthatja** az `X-Forwarded-For`-t → túl laza.

**Javaslat:** Prod-ban a legkülső proxy (Vercel/Cloudflare/Nginx) állítsa be a megbízható kliens IP-t (X-Forwarded-For vagy X-Real-IP). Ne bízzunk tisztán kliens által küldött headerben. Ha van `CF-Connecting-IP` (Cloudflare), érdemes azt preferálni.

**Gyors teszt (X-Forwarded-For figyelembevétel):**  
Küldj 10 hibás logint **különböző** `X-Forwarded-For` értékekkel. Ha a rate limit IP-alapú és ezt a headert használjuk, akkor **különböző IP = különböző számláló** → mindegyik 401 marad (nem éri el a 10-et egy „IP”-n).  
Futtatás: `powershell -ExecutionPolicy Bypass -File scripts/test-1-ip-forwarded-for.ps1` (szerver futása mellett). Elvárt: 1.2.3.4 11. hívás = 429, 5.6.7.8 6. = 401.

---

### 2) Reservation „lejárat” – takarítva lesz-e?

**Count logika:** Jó. A lejárt RESERVED (`expiresAt < now`) **nem számít** aktívnak (`reservations.ts`: `countActiveReservations` csak RESERVED + `expiresAt > now` vagy PAID).

**DB állapot:** A sorok **nem** lesznek takarítva. A lejárt foglalások **örökre** RESERVED státuszban maradnak (az `EXPIRED` státusz a sémában van, de **egyetlen kód sem állítja be**). Nincs cleanup job (cron / scheduled task) EXPIRED-re állításra vagy törlésre.

**Összefoglalva:** Nem baj a működés szempontjából (új foglalás engedélyezett), de a DB növekszik. Ha kell: később lehet hozzáadni egy cleanup jobot (pl. napi/órás: `status = 'RESERVED' AND expiresAt < now()` → `EXPIRED`), vagy soft-delete / archiválás.

---

### 3) Sourcing race teszt – tényleg párhuzamos Windows alatt?

**Jelen script:** `test-2-sourcing-race.ps1` **valódi concurrency-t** csinál: **Start-Job** két külön runspace-ben indít két hívást. A két `Invoke-WebRequest` párhuzamosan fut (nem egymás után). A `Wait-Job $job1, $job2` csak a végeredményt várja.

**Limit:** A két job **nem** ugyanabban a pillanatban indul (Start-Job 1, majd Start-Job 2 → néhány ms eltérés). A race condition teszteléséhez ez általában **elegendő**, mert a szerver oldali tranzakció és a két kérés időbeli átfedése így is előjöhet.

**Szorosabb race (opcionális):** PowerShell 7+ esetén a script **ForEach-Object -Parallel**-t használhat: `$env:USE_PARALLEL=1; .\scripts\test-2-sourcing-race.ps1` – a két kérés ugyanabban a párhuzamos ciklusban indul, tényleg egyszerre megy.

---

## Lementve itt (összefoglaló)

- **Tesztek 1–6:** futtatási útmutató, curl, elvárások, kód alapú állapot.
- **Kérdések:** 1) IP proxy (X-Forwarded-For / X-Real-IP, teszt: `scripts/test-1-ip-forwarded-for.ps1`), 2) nincs reservation cleanup job (sorok maradnak), 3) race teszt Start-Job = párhuzamos, PS 7+ USE_PARALLEL=1.
- **Végeredmény mondat:** kitöltendő a tesztek után (PASS / FAIL).

### 3D nyomtatott termékek – külön „doboz”

- **Összes termék** (`/termekek`, nav: „Az összes termék”): **nem** tartalmazza a 3D nyomtatott termékeket; csak a többi kategória (táskák, ruházat, kiegészítők, elektronika, otthon).
- **3D Nyomtatott Termékek** (`/termekek?kategoria=3d-nyomtatott`): **csak** 3D termékek, saját fülekkel (Konyha, Játék, Kert, Lakásdekor, Eszközök, Kreatív, Ajándék). Nem keveredik más termékkel.
- **Implementáció:** `src/components/ShopContent.tsx` – `productsForView`: ha `kategoria=3d-nyomtatott` → csak `is3DProduct(p)`; egyébként → csak `!is3DProduct(p)`. Szűrők (méret, állapot) is ezen alapulnak.
