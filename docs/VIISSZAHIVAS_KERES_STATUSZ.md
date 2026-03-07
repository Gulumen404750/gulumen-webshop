# 🔍 Visszahívás kérés – technikai státusz

*Utolsó frissítés: 2025-02-20*

---

## 1️⃣ Frontend

### Melyik endpointot hívja?
**`/api/callback-request`**

### HTTP metódus
**POST**

### Request (body) – JSON struktúra

```json
{
  "name": "string (trim, kötelező)",
  "phone": "string (trim, kötelező)",
  "topic": "string (trim, opcionális)",
  "preferredTime": "string (trim, opcionális)"
}
```

**Példa:**
```json
{
  "name": "Kovács János",
  "phone": "+36201234567",
  "topic": "Rendelés kérdés",
  "preferredTime": "Délután 14–16"
}
```

A frontend a **Kérj visszahívást** fülön (`CallUsModal.tsx`) küldi: `fetch('/api/callback-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, topic, preferredTime }) })`. A `topic` és `preferredTime` üres esetén `undefined`-ként megy (nem üres string).

---

## 2️⃣ Backend – `/api/callback-request`

### Validáció
- **Igen.** A route:
  - `name`: kötelező, trim, **min. 2 karakter** → különben `400` + `"Érvényes név szükséges (min. 2 karakter)."`
  - `phone`: kötelező, trim, **min. 6 karakter** → különben `400` + `"Érvényes telefonszám szükséges."`
- Rate limit: **60 kérés / perc / IP** (429 ha túllépés).

### Mentés a CallbackRequest táblába
- **Igen**, ha `isDbConfigured()` igaz (tehát `DATABASE_URL` be van állítva).
- Mezők: `name`, `phone`, `topic` (opcionális), `preferredTime` (opcionális), **`status: 'pending'**.
- Hiba esetén: `500` + `"Szerver hiba."`, a kliens ezt az `error` mezőben kapja.

### E-mail értesítés
- **Igen.** Meghívja a `sendCallbackRequestNotification(payload)` függvényt (`src/lib/voice-email.ts`).
- **Címzett:** `ADMIN_EMAIL` env.
- **Küldés:** Resend API (`RESEND_API_KEY`). Ha `ADMIN_EMAIL` vagy `RESEND_API_KEY` nincs megadva, **nem küld** e-mailt (csak log), de a válasz továbbra is `{ ok: true }` – a kérés sikeresnek számít.

### Telegram értesítés
- **Nincs.** A callback-request **nem** küld Telegram üzenetet. A Telegram csak a **call-summary** (AI hívás vége) webhooknál van használatban.

### Státusz mező
- **Van.** A `CallbackRequest` modellben: `status` – alapértelmezett **`"pending"`**. Lehetséges értékek (séma komment): **pending | done | cancelled**.
- Jelenleg **egyetlen hely sem állítja** `done`-ra vagy `cancelled`-re (nincs admin UI vagy job erre); a rekordok pending maradnak.

---

## 3️⃣ Webhook integráció

### Továbbítódik-e a CALLBACK_WEBHOOK_URL-re?
- **Igen**, ha az env-ben meg van adva a **`CALLBACK_WEBHOOK_URL`**.

### Formátum
- **Metódus:** POST  
- **Header:** `Content-Type: application/json`  
- **Body (JSON):**
```json
{
  "name": "string",
  "phone": "string",
  "topic": "string | undefined",
  "preferredTime": "string | undefined",
  "createdAt": "2025-02-20T12:00:00.000Z"
}
```
A `createdAt` a szerver idő szerint ISO string. A webhook hiba (4xx/5xx vagy fetch hiba) **nem** változtatja a API választ: a kérés továbbra is sikeres (`200` + `{ ok: true }`), csak a konzolra logolódik (`[callback-request] Webhook failed/error`).

---

## 4️⃣ Admin oldal – `/admin/dashboard/calls`

- **Látszanak a callback kérések?**  
  **Igen.** A „Visszahívás kérések (pending)” szekció listázza a **status = 'pending'** rekordokat (max. 50, `createdAt` desc).

- **Külön lista a pending visszahívásokra?**  
  **Igen.** Ez az egyetlen lista callbackre: csak a **pending** kérések jelennek meg. Név, telefon (kattintásra `tel:`), téma, preferált idő, létrehozás időpontja.

- **Mai hívásszám / Top címkék:** ezek a **Call** (voice) táblára vonatkoznak, nem a callback-re.

- **Megjegyzés:** Az admin oldal megnyitásához be kell jelentkezni (`/admin/login`). A callback státusz (pending → done) **még nem** állítható az admin felületen; ha kell, külön gomb/API kellene.

---

## 5️⃣ Tesztelés – Ha kitöltöd a formot

### Hova kerül az adat?
1. **Adatbázis:** `CallbackRequest` tábla (ha `DATABASE_URL` be van állítva): új sor `name`, `phone`, `topic`, `preferredTime`, `status: 'pending'`, `createdAt`.
2. **E-mail:** Ha van `ADMIN_EMAIL` + `RESEND_API_KEY` → egy „[Gulumen] Visszahívás kérés: &lt;név&gt;” tárgyú e-mail a megadott címre.
3. **Webhook:** Ha van `CALLBACK_WEBHOOK_URL` → a fenti JSON POST-olva arra a URL-re.

### Hol látod elsőként?
- **Admin:** Bejelentkezés után **`/admin/dashboard/calls`** → „Visszahívás kérések (pending)” lista. Itt azonnal megjelenik az új kérés (név, teló, téma, idő).
- **E-mail:** Ha be van állítva, az értesítés általában másodperceken belül megérkezik.

### Jön-e értesítés?
- **E-mail:** Igen, ha `ADMIN_EMAIL` és `RESEND_API_KEY` megvan.
- **Telegram:** Nem (callback esetén nincs Telegram).

### Mi történik hiba esetén?
- **Validáció (400):** A modalban piros szöveg: „Érvényes név szükséges…” vagy „Érvényes telefonszám szükséges.” A backend nem ment, nem küld e-mailt, nem hív webhookot.
- **Rate limit (429):** Válasz: `{ error: 'Túl sok kérés. Próbáld újra később.' }` – a modal ezt mutatja (callbackError vagy data.error).
- **DB hiba (500):** Válasz: `{ error: 'Szerver hiba.' }` – a modal „A kérés sikertelen.” vagy a kapott error szöveget jeleníti meg. E-mail és webhook **nem** futnak (a create után van az e-mail/webhook).
- **E-mail küldés sikertelen:** A backend **nem** ad hibát a kliensnek; a válasz továbbra is `{ ok: true }`. A hiba csak szerver logban látszik. Az adat **bent marad** a DB-ben.
- **Webhook sikertelen:** Ugyanígy: a kliens `{ ok: true }`-t kap, a webhook hiba csak log.

---

## 🎯 Összegzés – Működőképes-e?

| Réteg | Státusz |
|-------|--------|
| **Frontend** | ✅ POST `/api/callback-request`, helyes JSON body (name, phone, topic?, preferredTime?). |
| **Validáció** | ✅ Név min. 2, telefon min. 6 karakter; rate limit 60/perc/IP. |
| **Adatbázis** | ✅ CallbackRequest táblába mentés, status = 'pending'. (DB nélkül is 200 + ok: true, de nem ment.) |
| **E-mail** | ✅ Resend + ADMIN_EMAIL – ha mindkettő megvan, kimegy az értesítés. |
| **Telegram** | ❌ Nincs callback-requesthez. |
| **Webhook** | ✅ CALLBACK_WEBHOOK_URL → POST JSON (name, phone, topic, preferredTime, createdAt). |
| **Admin** | ✅ Pending lista a `/admin/dashboard/calls` oldalon; nincs státusz váltás (done/cancelled) UI. |

A rendszer **technikailag működőképes**: nem csak UI, hanem DB + e-mail (+ opcionális webhook). Éles használathoz szükséges: **DATABASE_URL**, és értesítéshez **ADMIN_EMAIL** + **RESEND_API_KEY**. A callback kéréseket az admin oldal „Visszahívás kérések (pending)” listájában látod elsőként.
