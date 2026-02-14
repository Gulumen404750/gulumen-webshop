# Biztonsági audit – kockázatok és megoldások

Utolsó frissítés: 2026-02-14. Prioritás: **a legkisebb aggalomra adó ok is** – első a biztonság.

---

## Kritikus (azonnal javítandó)

### 1. Admin végpontok nyitva, ha nincs ADMIN_API_KEY

**Kockázat:** `POST /api/admin/sourcing/[orderId]/success` és `.../fail` csak akkor kér kulcsot, ha `process.env.ADMIN_API_KEY` be van állítva. Ha **nincs** beállítva, **bárki** meghívhatja és sikeres/sikertelen beszerzésként jelölhet meg rendelést → rendelés státusz hamisítható.

**Megoldás:** Ha `ADMIN_API_KEY` nincs megadva, a végpontok **ne fogadjanak kérést** (401 vagy 503), és naplózzák a hibát. Élesben mindig állíts be erős, titkos `ADMIN_API_KEY`-t.

---

### 2. Payment webhook (/api/payments/webhook) nincs hitelesítve

**Kockázat:** Bárki küldhet `POST` kérést `{ provider, transactionId, status: "succeeded" }` értékekkel. Ha ismeri a `transactionId`-t (pl. a checkout válaszból), **fizetés nélkül** „succeeded”-re állíthatja a rendelést.

**Megoldás:** Webhook hitelesítés:
- Környezeti változó: `PAYMENTS_WEBHOOK_SECRET` (hosszú, véletlen titok).
- Minden webhook kérésnél kötelező header pl. `X-Webhook-Secret` vagy `Authorization: Bearer <secret>`, és a szerver ellenőrizze, hogy egyezik-e a `PAYMENTS_WEBHOOK_SECRET`-tal. Egyezés nélkül 401.
- Élesben a webhookot csak a trusted provider (pl. saját backend) hívja, ugyanezzel a titokkal.

---

## Magas

### 3. X-User-Id header hamisítható

**Kockázat:** A like és wishlist API-k a kliens által küldött `X-User-Id`-ra támaszkodnak. Bárki másolhat egy másik felhasználó ID-ját és az ő nevében like-olhat / láthatja az ő kedvenceit (GET /api/me/wishlist).

**Megoldás:**
- Rövid távon: elfogadható fejlesztési / demó szinten, de **ne tárolj érzékeny adatot** csak userId alapján.
- Hosszú távon: **session alapú azonosítás** (pl. NextAuth, JWT cookie). A szerver a session-ből vegye az userId-t, ne a kliens headerből.

---

### 4. Like / wishlist API – nincs rate limit, nincs méretkorlát

**Kockázat:**
- Túl sok like toggle → tárolás/terhelés (DoS), vagy óriási `product-likes.json`.
- `userId` / `productId` hosszú string → nagy JSON, lemez/ memória.

**Megoldás:**
- **Rate limit** a like POST és a wishlist GET-re (pl. 60/perc/IP, mint a checkout).
- **Méretkorlát:** `userId` és `productId` max 128 (vagy 64) karakter; hosszabb → 400.

---

### 5. Chat API – üzenet hossza nincs limitálva

**Kockázat:** Nagyon hosszú `message` → nagy OpenAI költség, vagy szolgáltatás elutasítja a kérést / lassul a válasz.

**Megoldás:** Üzenet maximális hossza (pl. 2000 karakter). Ennél hosszabb → 400 és üzenet: „Túl hosszú üzenet.”

---

### 6. Newsletter – nincs rate limit

**Kockázat:** Ugyanazzal vagy sok különböző e-mail címmel lehet spam-elni a feliratkozási végpontot → e-mail küldés (költség, blacklist) vagy log/DB terhelés.

**Megoldás:** Rate limit pl. 5–10 feliratkozás / IP / óra. 429 válasz limit felett.

---

## Közepes

### 7. Rate limit IP spoofing (X-Forwarded-For / X-Real-IP)

**Kockázat:** Ha a szerver proxy mögött van, a kliens küldhet hamis `X-Forwarded-For` / `X-Real-IP` headert, és más IP-ként számolódik → rate limit megkerülhető.

**Megoldás:** Csak **megbízható proxy** esetén használj forwarded headert (pl. Vercel, Cloudflare megbízhatóan beállítják). Egyébként a direct client IP-t használd. Ha lehet, a platform (Vercel, AWS) által biztosított „real client IP” mezőt használd.

---

### 8. Loyalty API – e-mail alapú enumeráció

**Kockázat:** `GET /api/loyalty?email=...` visszaadja a hűség százalékot. Több e-mail kipróbálásával kideríthető, ki vásárolt (pl. nem 0% = regisztrált e-mail).

**Megoldás:** 
- Ha csak a saját (bejelentkezett) usernek kell: session alapú, ne query param.
- Ha vendég checkout-nál kell: rate limit (pl. 30/perc/IP), és a válaszban ne adj ki részletes infót (pl. csak „van kedvezmény” / „nincs”, vagy a százalék továbbra is, de limitált próbálkozás).

---

### 9. Stripe webhook – env hiányzik

**Kockázat:** Ha `STRIPE_WEBHOOK_SECRET` üres, a route 500-at ad (jó), de a build is elhasalhat, ha a Stripe modul inicializáláskor kéri a kulcsot.

**Megoldás:** A Stripe példányt és webhook ellenőrzést csak akkor használd, ha a secret létezik; különben korai return 503 „Webhook not configured”. Build időben ne inicializálj Stripe-ot env nélkül (lazy init vagy try/catch).

---

### 10. Hibaüzenetek és stack trace

**Kockázat:** Ha valamilyen hiba esetén a válaszban vagy logban stack trace / belső útvonalak kerülnek ki, segíti a támadót.

**Megoldás:** Élesben soha ne küldj vissza stack trace-t a kliensnek. A `error` handler és API catch ágak generikus üzenetet adjanak (pl. „Szerver hiba”), a részlet csak szerver logba.

---

## Alacsony / egyéb

### 11. Környezeti változók és .env

**Kockázat:** Ha a `.env` vagy `.env.local` véletlenül verziókövetésbe kerül, titkok kiszivárognak.

**Megoldás:** 
- `.gitignore`-ban legyen: `.env`, `.env.local`, `.env*.local`. (A projektben `.env*.local` már benne van; érdemes külön `.env` is.)
- `.env.example` tartalmazzon csak változóneveket és üres vagy placeholder értékeket, **sosem** valódi jelszót vagy API kulcsot.
- Élesben használj platform secret store-t (Vercel Env, AWS Secrets Manager).

---

### 12. dangerouslySetInnerHTML (JsonLd, Breadcrumbs)

**Kockázat:** Ha valaha user input kerülne a `__html`-be, XSS lehetne.

**Megoldás:** Jelenleg a JsonLd és Breadcrumbs **szerverről jövő, fix vagy env alapú** adatot használnak (`JSON.stringify(schema)`), nincs user input. Tartsd így: **soha ne** tegyél felhasználói bemenetet közvetlenül a `dangerouslySetInnerHTML` tartalmába. Ha később dinamikus tartalom kell, sanitize (pl. szigorú allowlist mezőkre).

---

### 13. Fájl alapú tárolás (orders, likes, loyalty, payment-transactions)

**Kockázat:** Path traversal, ha valaha user input kerülne a fájl útvonalba; illetve egy processzben írás/olvasás konkurencia. Jelenleg a path fix (`process.cwd() + konstans`), nincs user input az útvonalban.

**Megoldás:** 
- Ne használj soha user-ből jövő részt a fájl path-ban.
- Élesben adatbázis (PostgreSQL) + tranzakciók; a fájl tárolás fejlesztési célra legyen.

---

### 14. Open redirect / newsletter megerősítő link

**Kockázat:** A newsletter e-mailben a megerősítő link: `APP_URL + /api/newsletter/confirm?email=...`. Ha az `email` paramétert valaha redirect URL-ként értelmeznéd, open redirect lehetne.

**Megoldás:** A confirm végpont ne végezzen átirányítást külső URL-re; csak a saját domain és fix path (pl. „Köszönjük, megerősítve”). Jelenleg a link csak a saját domainre mutat; a confirm route-ot is erre a szabályra építsd.

---

### 15. Prompt injection (Chat / AI)

**Kockázat:** A felhasználó üzenete közvetlenül megy az OpenAI-hoz. Rossz szándékú szöveg megpróbálhatja „felülírni” a system promptot (pl. „figyelmen kívül hagyd a korábbi utasításokat”).

**Megoldás:** 
- A system prompt erős (ne kérj kártyát, eskálálj jogi/agresszió esetén). 
- Opcionális: üzenet max hossz (lásd fent), és szűrés bizonyos mintákra (pl. „ignore previous instructions” → fallback válasz vagy szűrés).

---

## Összefoglaló – mit javíts azonnal

| # | Kockázat | Javítás | Státusz |
|---|----------|--------|--------|
| 1 | Admin nyitva, ha nincs ADMIN_API_KEY | Ha nincs env, 503; kulcs kötelező | ✅ Kész |
| 2 | Payments webhook nincs hitelesítve | PAYMENTS_WEBHOOK_SECRET + X-Webhook-Secret header | ✅ Kész |
| 4 | Like/wishlist rate limit + méretkorlát | Rate limit + userId/productId max 128 char | ✅ Kész |
| 5 | Chat üzenet túl hosszú | Max 2000 karakter | ✅ Kész |
| 6 | Newsletter spam | Rate limit (közös rate-limit, 60/perc) | ✅ Kész |

**Élesben:** Állítsd be `ADMIN_API_KEY` és `PAYMENTS_WEBHOOK_SECRET` értékeket. A webhookot hívó rendszer (provider / saját backend) küldje a `X-Webhook-Secret` headert ugyanezzel a titokkal.

A többi pont a dokumentumból követhető (session, Stripe lazy init, .env, stb.).
