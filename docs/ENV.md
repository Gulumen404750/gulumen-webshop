# Környezeti változók (env)

## Kötelező / fontos

### DATABASE_URL
- **Típus:** `postgresql://...` vagy (Prisma Accelerate / local) `prisma+postgres://...`
- **Ellenőrzés:** `isDbConfigured()` csak azt nézi, hogy a string meg van-e adva és nem üres (`src/lib/prisma.ts`). Nem teszteli a kapcsolatot.
- **Ha nincs megadva:** Regisztráció/login 503; rendelések/ordersCount JSON fallback (`data/orders.json`). A `/beszerzesre-rendelheto` és termékoldal nem dob, DB hiba esetén JSON-ra esik vissza.

Példák:
```bash
# Közvetlen Postgres (Supabase, Neon, Railway)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# Prisma Accelerate (prisma://)
# Prisma lokál (prisma+postgres://...) – csak ha prisma dev fut
```

**postgresql:// vs prisma+postgres:// (Prisma Accelerate):**
- **postgresql://** – közvetlen Postgres kapcsolat (Supabase, Neon, Railway, lokál Postgres). Az app egyből a DB-hez beszél. Migráció: `npx prisma migrate deploy`.
- **prisma+postgres://** (vagy **prisma://**) – Prisma Data Proxy / Accelerate: a kérés egy Prisma szolgáltatáson megy át, ami a Postgres-hez kapcsolódik. Hasznos felhőben (connection pooling, cache). Lokálban csak akkor működik, ha a Prisma dev/proxy fut. Migrációkhoz általában **DIRECT_URL** kell (közvetlen postgresql://).

**Local dev – mit csinálj:**
- **DB nélkül:** Ne állíts be `DATABASE_URL`-t (vagy töröld). Az app JSON fallbackot használ (`data/orders.json`), a `/beszerzesre-rendelheto` és a termékoldal betölt, ordersCount a JSON-ból jön.
- **DB-vel:** Állíts be érvényes `postgresql://...`-t, futtasd a migrációt: `npx prisma generate`, majd `npx prisma migrate deploy` (vagy `migrate dev`). Ekkor a rendelések és az ordersCount a DB-ből jönnek.

### DIRECT_URL (opcionális)
- **Ha Prisma Accelerate-ot használsz** (`prisma://`), a migrációkhoz kell közvetlen Postgres URL. A `schema.prisma`-ban add hozzá: `directUrl = env("DIRECT_URL")`, és az `.env`-ben: `DIRECT_URL="postgresql://..."`.
- Jelenlegi `schema.prisma` csak `url = env("DATABASE_URL")` – DIRECT_URL nincs benne.

### JWT_SECRET
- **Auth:** session cookie aláíráshoz. Legalább 16 karakter. Pl. `openssl rand -hex 32`.
- Ha nincs: `getSession()` null, register/login 503 ha nincs DB sem.

---

## DB kapcsolat tesztelése

1. **Env ellenőrzés:**  
   `DATABASE_URL` be van állítva? (Ha nincs, az app JSON módban van, nem próbál Prisma-t.)

2. **Prisma generate:**  
   `npx prisma generate`

3. **Migráció (közvetlen Postgres esetén):**  
   `npx prisma migrate deploy`  
   (Prisma Accelerate esetén általában a deploy pipeline futtatja DIRECT_URL-lal.)

4. **Egy query teszt (Node/Next):**  
   A `src/lib/prisma.ts` exportálja a `checkDbConnectivity()` függvényt:  
   `prisma.$queryRaw\`SELECT 1\`` try/catch-kal, ~60 s cache. Pl. health API:
   ```ts
   import { checkDbConnectivity } from '@/lib/prisma'
   const ok = await checkDbConnectivity()
   ```

5. **Ha „fetch failed” / service unreachable:**  
   - `prisma://` / `prisma+postgres://`: a szolgáltatás (Accelerate vagy lokál prisma dev) fut? Van internet/tűzfal?
   - Lokál dev: ha nincs DB, ne állíts be `DATABASE_URL`-t, vagy állíts be érvényes `postgresql://`-t. Így a try/catch + JSON fallback miatt az app nem omlik össze.

### NEXT_PUBLIC_SUPPORT_PHONE (opcionális)
- **Hívj minket:** A header, footer és sticky CTA megjelenített és használt telefonszáma. Pl. `+36301234567`.
- Ha nincs megadva: a kód a `+36301234567` placeholdert használja (cseréld éles számra).

### CALLBACK_WEBHOOK_URL (opcionális)
- **Visszahívás kérés:** Ha megadod, a `/api/callback-request` POST body-t (name, phone, topic, preferredTime, createdAt) továbbítja erre a URL-re (pl. Make.com scenario webhook, Airtable, saját backend).
- Ha nincs: a kérés rögzítve, logolva; webhook nem hívódik.

---

## AI telefon / Voice integráció

### TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (opcionális)
- **Twilio:** Telefonszám és híváskezelés (voice agent konfigban használandó). A weboldal nem hívja közvetlenül; a Vapi/Retell köti a számot.

### VOICE_AGENT_WEBHOOK_SECRET (voice endpointokhoz)
- **Kötelező** ha használod a `/api/call-summary` vagy `/api/ai-voice` endpointokat. A voice agent (Vapi/Retell) ezt küldi `Authorization: Bearer <secret>` vagy `x-webhook-secret` headerben.
- **call-summary:** webhook hívás hitelesítés.
- **ai-voice:** API kulcs hitelesítés (`Bearer` vagy `x-api-key`).

### OPENAI_API_KEY (ai-voice)
- **AI válaszok:** A `/api/ai-voice` ezzel generál rövid választ (gpt-4o-mini). Ha nincs, fallback szöveg kerül vissza.

### TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (opcionális)
- **Telegram:** Hívás összefoglaló értesítés a `/api/call-summary` után. Bot token + chat ID (ahova küldjük az üzenetet).

### ADMIN_EMAIL
- **Értesítések:** Visszahívás kérés, hívás összefoglaló, **gyanús belépés / fiókzárolás**, **és admin anomália** e-mail címzettje. Ha nincs, e-mail nem kerül kiküldésre (audit/log marad, a művelet nem 500-ozik).
- **Admin anomália (valós idejű, nem blokkol):** nagy CSV-export (alap: ≥100 sor), tömeges árváltoztatás (≥10 termék), burst törlés (≥5 termék/user/kupon törlés 10 perc alatt). Küszöbök: `ADMIN_ANOMALY_CSV_MIN`, `ADMIN_ANOMALY_BULK_PRICE_MIN`, `ADMIN_ANOMALY_DELETE_MIN`, `ADMIN_ANOMALY_DELETE_WINDOW_MIN` (perc). `RESEND_API_KEY` kell a tényleges levélhez.

### CRON_SECRET (napi adatmegőrzési job)
- **Cron:** A `GET /api/cron/data-retention` (Vercel Cron, napi 1×) ezt várja: `Authorization: Bearer <CRON_SECRET>`. Ha nincs vagy nem egyezik, 401.
- Vercelnél állíts be egy titkos értéket (pl. 32 char), és a Cron Jobs automatikusan küldi a headerben.

### Callback rendszer (DB nélkül)
- Ha **DATABASE_URL** nincs: a callback kérés **nem** mentődik DB-be. Legalább egy fallback kötelező: **ADMIN_EMAIL + RESEND_API_KEY** (e-mail) **vagy** **CALLBACK_WEBHOOK_URL**. Ha egyik sincs → 500 + „Callback rendszer nincs konfigurálva”.

---

## Összefoglaló

| Változó                     | Kötelező | Megjegyzés |
|-----------------------------|----------|------------|
| DATABASE_URL                | Nem      | Ha nincs: JSON orders, 503 auth. Ha van de elérhetetlen: ordersCount/orders try/catch → JSON fallback. |
| DIRECT_URL                  | Nem      | Csak ha Prisma Accelerate + migráció. |
| JWT_SECRET                  | Auth-hoz | Regisztráció/login session-höz. |
| NEXT_PUBLIC_SUPPORT_PHONE   | Nem      | Ügyfélszolgálati telefonszám (Hívj minket). |
| CALLBACK_WEBHOOK_URL        | Nem      | Visszahívás kérések továbbítása (Make/CRM). |
| VOICE_AGENT_WEBHOOK_SECRET  | Voice-hoz| call-summary + ai-voice hitelesítés. |
| OPENAI_API_KEY              | Nem      | ai-voice rövid válaszok (ha nincs: fallback szöveg). |
| TELEGRAM_BOT_TOKEN / CHAT_ID| Nem      | Hívás összefoglaló Telegramra. |
| ADMIN_EMAIL                 | Nem      | Callback + call-summary + lockout + admin anomália-riasztás. |
| CRON_SECRET                 | Cron-hoz | Napi data-retention job (Vercel Cron). |
| RESEND_API_KEY              | E-mailhez| Callback + call-summary + admin anomália-riasztás (Resend). |
