# Gulumen webshop – Architektúra elemzés

## 1. Projekt típus
**Full-stack.** A frontend (React, Next.js App Router) és a backend (Next.js API routes, szerveroldali logika) egy monolit Next.js alkalmazásban van.

---

## 2. Programozási nyelvek
- **TypeScript** – fő nyelv (app, API, lib, komponensek)
- **JavaScript** – build/scriptek (pl. `scripts/convert-3d.mjs`)
- **CSS** – Tailwind (globals.css, Tailwind konfig)
- **JSON** – fordítások (i18n), opcionális adat (orders fallback)

---

## 3. Node.js szerver
**Igen.** A projekt Next.js 14-et használ; a futás `next dev` / `next start` alatt Node.js környezetben történik.

---

## 4. Keretrendszer
**Next.js 14** (App Router). Nincs külön Express/Nest/Fastify; a backend a Next.js API route-okban van (`src/app/api/...`).

---

## 5. PHP backend
**Nincs.** Nincs PHP fájl, csak Node/Next.js.

---

## 6. Python backend
**Nincs.** Nincs Python kód a projektben.

---

## 7. Külön API réteg
**Van, de nem külön szolgáltatás.** Az API réteg a Next.js része: `src/app/api/*` – REST-szerű route-ok (pl. `/api/auth/login`, `/api/chat`, `/api/stripe/create-checkout-session`). Nincs külön API szerver vagy réteg.

---

## 8. Frontend–backend kommunikáció
- **REST** – GET/POST a `/api/*` útvonalakra
- **fetch()** – a kliens mindenhol a natív `fetch`-et használja (nincs axios)
- **Credentials:** `credentials: 'include'` – cookie (session, admin) minden kérésnél
- **Formátum:** JSON body (POST), JSON response

Példa: `AIAssistant.tsx` → `fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message, locale }) })`.

---

## 9. Adatbázis
**Igen.**  
- **Típus:** **PostgreSQL**  
- **ORM:** Prisma (`prisma/schema.prisma`, `@prisma/client`)  
- **Kapcsolat:** `DATABASE_URL` környezeti változó (pl. `postgresql://...`).  
Ha nincs `DATABASE_URL`, az app nem használ Prisma-t rendelésekhez: **JSON fallback** (`data/orders.json`), és a regisztráció/login 503-at ad.

---

## 10. Chat beszélgetések mentése
**Nincs perzisztens mentés.**  
A chat üzenetek **csak a böngészőben, React state-ben** vannak (`AIAssistant.tsx` – `useState<Message[]>`). Nincs adatbázis tábla a beszélgetésekhez, nincs backend mentés. Az oldal bezárásakor/újratöltéskor az üzenetek elvesznek.

---

## 11. Beszélgetések adatstruktúrája
Csak kliens oldali struktúra (nem tárolt):

- **Üzenet:** `{ role: 'user' | 'assistant', text: string, escalate?: boolean }`
- **Lista:** `Message[]` – tömb a komponens state-ben. Nincs szerveroldali séma vagy tárolás.

---

## 12. Felhasználó azonosítás (session, cookie, token)
**Van.**  
- **Session:** JWT, **httpOnly cookie** (`gulumen-session`)  
- **Könyvtár:** `jose` (SignJWT, jwtVerify)  
- **Tartalom:** `userId` (sub), `email`, lejárat 30 nap  
- **Beállítás:** Login/regisztráció után `Set-Cookie` (Path=/, HttpOnly, SameSite=Lax, Secure prod-ban)  
- A token **csak szerveren** érvényesítve (`getSession(request)` a `src/lib/auth.ts`-ben).

---

## 13. Visszatérő felhasználó felismerése
A böngésző minden kérésnél elküldi a `gulumen-session` cookie-t. A szerver a middleware vagy az API route-okban (pl. `getSession(request)`) ellenőrzi a JWT-t (issuer, audience, lejárat). Ha érvényes → `SessionUser { userId, email }`, ha nem → null. A frontend a `/api/auth/session` hívással tudja, hogy be van-e jelentkezve.

---

## 14. Authentication rendszer
**Igen.**  
- **Regisztráció:** `POST /api/auth/register` – email, jelszó, opcionális név; bcrypt hash, User a DB-ben, session cookie  
- **Bejelentkezés:** `POST /api/auth/login` – email + jelszó, rate limit (login-rate-limit), session cookie  
- **Kijelentkezés:** `POST /api/auth/logout` – cookie törlése  
- **Session lekérés:** `GET /api/auth/session` – cookie alapján user adatok  
- **Jelszó:** bcrypt (bcryptjs), tárolás: `User.passwordHash`

---

## 15. Admin panel
**Igen.**  
- **Útvonalak:** `/admin/*` (pl. `/admin/dashboard/calls`)  
- **Védelm:** Middleware (`src/middleware.ts`): ha nincs `admin_authorized` cookie, átirányítás `/admin/login`-ra  
- **Bejelentkezés:** `POST /api/admin/login` – body: `{ key: string }`; ha `key === ADMIN_API_KEY`, beállítja az `admin_authorized=1` httpOnly cookie-t (24 óra)  
- Nincs külön admin user tábla; egy közös `ADMIN_API_KEY` env.

---

## 16. AI chatbot integráció
- **UI:** `AIAssistant` komponens – lebegő gomb, chat ablak, üzenetlista, input  
- **Kliens:** űrlap beküldése → `POST /api/chat` (message, locale)  
- **Szerver:** `src/app/api/chat/route.ts` – rate limit, validáció, majd:
  - Ha van **OPENAI_API_KEY:** hívja az **OpenAI** API-t (`gpt-4o-mini` vagy `gpt-4o`), egy üzenetre válasz
  - Ha nincs kulcs vagy hiba: **rule-based fallback** (`getResponse()` a `src/lib/ai-assistant.ts`-ből) + i18n szövegek

---

## 17. Használt AI API
**OpenAI** – `https://api.openai.com/v1/chat/completions` (Chat Completions). Modellek: `gpt-4o-mini`, `gpt-4o` (fallback sorrendben).

---

## 18. Chatbot válaszok: streaming vagy normál
**Normál válasz.** A válasz egy JSON objektum: `{ text, escalate }`. Nincs Server-Sent Events vagy streaming; a teljes válasz egyszerre jön vissza.

---

## 19. Chatbot hívások: frontend vagy backend
**Backend.** A frontend csak a saját API-t hívja: `POST /api/chat`. Az OpenAI hívást a Next.js API route intézi (szerveren), így az **OPENAI_API_KEY** soha nem kerül a kliensre.

---

## 20. AI API kulcs tárolása
**Szerver oldalon, környezeti változóban.**  
- `process.env.OPENAI_API_KEY` (pl. `.env`, Vercel Environment Variables, Railway env).  
- Nincs a kódban vagy a frontend bundle-ben; csak a Node/Next.js szerver látja.

---

## 21. WebSocket / realtime kommunikáció
**Nincs.** Nincs WebSocket, Socket.IO, SSE vagy más realtime csatorna a kódbázisban. Minden kérés kérés–válasz (fetch).

---

## 22. Visszaszámláló (sourcing deal)
**Frontendben fut.**  
- **Komponens:** `SourcingDealCardCountdown.tsx`  
- **Logika:** `setInterval(..., 1000)` másodpercenként frissít; a „aktuális idő” számításához a szerver ad egy `serverNow` értéket (SSR), és a kliens localStorage-ban tárol egy időreferenciát (`gulumen_sourcing_time_ref`), hogy lapok/ablakok között ne csússzon el a számláló.  
- A lejárt/elfogyott státusz a `getSourcingDealStatus()` (termék + idő + ordersCount) alapján számolódik; a backend csak a `serverNow` és az `ordersCount` adatát szolgáltatja.

---

## 23. Webshop / vásárlási funkció
**Igen.** Van terméklista, kosár (CartContext), kedvencek (WishlistContext), termékoldal, „beszerzésre rendelhető” időzített akciók, pénztár és fizetés.

---

## 24. Fizetés kezelése
- **Szolgáltató:** **Stripe**  
- **Folyamat:** Kosár → `POST /api/stripe/create-checkout-session` (termékek, kedvezmény, email) → backend létrehoz rendelést (Order + OrderItem), majd Stripe Checkout Session → a válaszban `session.url` → átirányítás a Stripe pénztárra → sikeres fizetés után Stripe **webhook** (`/api/stripe/webhook` vagy `/api/payments/webhook`) → rendelés státusz frissítése, loyalty stb.  
- **Környezeti változók:** `STRIPE_SECRET_KEY`, opcionálisan `STRIPE_COUPON_ID_5PERCENT`, `NEXT_PUBLIC_APP_URL` (success/cancel URL-ökhez).

---

## 25. Cron / háttérfolyamat
**Van.**  
- **Vercel Cron** (`vercel.json`): napi 1×, 03:00 – `GET /api/cron/data-retention`  
- **Feladat:** Adatmegőrzés – CallbackRequest 180 nap után törlése, Call 180 nap után törlése, transcript 60 nap után nullázása; napló: DataRetentionLog  
- **Hitelesítés:** `Authorization: Bearer <CRON_SECRET>` – a cron job csak ezzel a titkos értékkel hívja az endpointot.

---

## 26. Szerver erőforrás igény
- **Folyamatosan futó Node folyamat** (vagy serverless függvények) – Next.js API-k, auth, Stripe, OpenAI proxy, Prisma/Postgres elérés.  
- **Statikus hosting önmagában nem elég** – kell Node runtime az API, session, DB és külső szolgáltatások miatt.

---

## 27. Folyamatosan futó szerver vs. statikus hosting
**Kell futó szerver (vagy serverless).** Statikus hosting (pl. csak HTML/CSS/JS fájlok) nem elegendő: API routes, session, adatbázis, Stripe, OpenAI, cron mind szerveroldali futást igényel.  
Megfelelő: **Vercel** (serverless), **Railway**, **Render**, **Node VPS** stb.

---

## 28. Shared hosting
**Általában nem.** A tipikus shared hosting (cPanel, PHP/Apache) nem futtat Node.js/Next.js alkalmazást. Kivétele lehet, ha a szolgáltató kínál Node.js támogatást (pl. egyes Hostinger csomagok); akkor is gyakran korlátozott (pl. nincs cron, vagy más env kezelés).

---

## 29. Hostinger
**Attól függ.**  
- **Közös shared hosting (PHP):** Nem megfelelő.  
- **VPS** vagy **Node.js támogatott csomag:** Elméletileg futtatható, ha van Node, npm, és lehet Postgres-t vagy külső DB-t használni. A Vercel Cron helyett külső cron (pl. cron-job.org) kellene a data-retention endpoint meghívására.

---

## 30. Railway
**Igen, jól illeszkedik.** Railway támogatja a Node.js alkalmazást, beépített Postgres addon-t, környezeti változókat és saját domain-t. A cron-t külső szolgáltatással (pl. Vercel Cron, cron-job.org) kell meghívni, vagy egy egyszerű „cron worker” a Railway-on.

---

## 31. Ideális deployment architektúra
- **Platform:** **Vercel** (már használatban: `vercel.json`, cron) vagy **Railway** / **Render**.  
- **Adatbázis:** Managed PostgreSQL (Neon, Supabase, Railway Postgres, Render Postgres).  
- **Env:** Minden titkos kulcs (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, STRIPE_*, ADMIN_API_KEY, CRON_SECRET, stb.) a platform env felületén.  
- **Cron:** Vercel Cron (ha Vercel) vagy külső cron, amely `Authorization: Bearer CRON_SECRET`-tel hívja a `/api/cron/data-retention`-t.  
- **Stripe webhook:** Éles URL (pl. `https://<domain>/api/stripe/webhook`) a Stripe Dashboardon, megbízható külső hálózat (Vercel/Railway) mellett.

---

## 32. Skálázási limitek
- **Vercel:** Serverless function timeout/memory, invocation limit a csomagtól függően; cold start.  
- **DB:** Postgres connection limit (Prisma connection pool, vagy Prisma Accelerate).  
- **Stripe:** Webhook idempotencia, rate limit – a jelenlegi design megfelelő.  
- **Auth/Chat:** Stateless; horizontálisan skálázható több instance-szal, ha a session cookie és a DB megosztott.  
- Nincs saját WebSocket/long-polling; a terhelés főleg HTTP kérésekből és DB lekérdezésekből adódik.

---

## 33. ~4000 látogató/hó – becsült erőforrás
Nagyságrendileg **alacsony terhelés**.  
- **App:** 1 shared instance (Vercel Hobby/Pro) vagy 1 kis Railway/Render instance (512 MB–1 GB RAM) általában bőven elég.  
- **DB:** Kis Postgres (pl. Neon free tier, Railway 512 MB, Supabase free) elegendő.  
- **Bandwidth:** Statikus asset + API válaszok; 4000 látogató esetén néhány GB/hó reális.  
- **Költség:** Vercel free/hobby + ingyenes/olcsó Postgres esetén nagyon alacsony; fizetős csomagokkal is moderált.

---

## 34. Architektúra diagram (egyszerű)

Lásd: `ARCHITEKTURA_DIAGRAM.md` (Mermaid) és a generált `architektura-diagram.png`.

---

## 35. Admin felület – mit látsz és mit tudsz csinálni

### Bejelentkezés (`/admin/login`)
- Egyetlen mező: **API kulcs** (az `ADMIN_API_KEY` env értéke).
- Belépés után átirányítás a dashboardra (alapból `/admin/dashboard/calls`).
- Nincs felhasználónév/jelszó, csak ez a közös kulcs.

### Dashboard – Hívások (`/admin/dashboard/calls`)

**Mit látsz:**

1. **Összesítő kártyák (felül):**
   - **Mai hívások** – a mai napon érkezett AI/voice hívások száma.
   - **Visszahívás függőben** – pending státuszú „Kérj visszahívást” kérések száma.
   - **Top címkék** – az utóbbi 100 hívás leggyakoribb címkéi (pl. shipping, callback_required).

2. **Mai hívások lista:**
   - Minden hívás: `callId`, időpont (hu-HU), hossz (mp), nyelv, mód (b2c/b2b), hívó száma (ha van), címkék, rövid összefoglaló (ha van).
   - Ikonok a befejezés okához: csend timeout, nem válaszolt, max hossz, normál.

3. **Visszahívás kérések (pending):**
   - Név, telefon (kattintással hívás), téma, preferált idő, létrehozás időpontja.
   - Jelzés, ha sem e-mail, sem webhook nem ment ki (⚠️).
   - **Megjegyzés** mező (max 200 karakter) – saját jegyzet a kéréshez.
   - **✅ Done** – „megoldott”-ként jelölöd, és opcionálisan mented a megjegyzést.
   - **❌ Cancelled** – „törölt / nem kell visszahívni”.

4. **Top témák (címkék):**
   - Az utóbbi 100 hívás címkéi gyakoriság szerint, „tag × szám” formában.

5. **Navigáció:**
   - **Kijelentkezés** – `/api/admin/logout` (törli az admin cookie-t).
   - **← Vissza a főoldalra** – a webshop főoldalára.

### Amit az admin felületen **nem** látsz / nem tudsz

- **Rendelések listája** – nincs admin UI a rendelések böngészésére.
- **Sourcing success/fail** – nincs gomb a dashboardon. A beszerzés sikeres/sikertelen jelölése csak **API-n** van:  
  `POST /api/admin/sourcing/:orderId/success` és `POST /api/admin/sourcing/:orderId/fail`  
  az `x-admin-key` headerrel (pl. script vagy külső eszköz hívja).
- **Felhasználók, termékek, statisztikák** – nincs ilyen admin oldal.

Összefoglalva: az admin **kizárólag a voice/callback vonal** kezelésére van: mai hívások, visszahívás kérések done/cancelled-re állítása és megjegyzés írása.

