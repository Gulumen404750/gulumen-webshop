# Gulumen Webshop

Minimalist, premium ecommerce webshop – mixed products (bags, clothing, electronics, accessories) with AI customer assistant (HU/EN/DE).

## Run (local)

```bash
npm install
cp .env.example .env   # fill in values locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Railway deploy (www.gulumen.com)

### 1. Helyes service

Deploy **csak** a **gulumen-webshop** service-re (NE `dynamic-perfection`).

- **Settings → Root Directory:** üres vagy `.` (ne legyen almappa)
- **Source:** GitHub repo, branch `master`
- **Build:** `npm run build` (nixpacks / railway.json)
- **Start:** `npm run start` → `scripts/start.js`

### 2. Sikeres indulás logban (ellenőrzőlista)

Push után a **Deploy → Logs** elején ezeknek kell megjelenniük:

```
[start] gulumen-webshop bootstrap v5
[start] NextAuth secret: ok
[start] JWT secret: ok
[start] NextAuth URL: https://www.gulumen.com
[start] Listening on 0.0.0.0:8080 (Railway PORT=8080)
```

A `NO_SECRET` hiba **nem** jelenhet meg, ha a bootstrap v5 kód fut – a titok mindig be van állítva fallbackkel is.

### 3. Railway Variables – kötelező (gulumen-webshop)

| Name (pontosan így) | Value | Megjegyzés |
|---------------------|-------|------------|
| `DATABASE_URL` | **Reference** → Postgres service → `DATABASE_URL` | Kötelező – nélküle a start leáll |
| `NEXT_PUBLIC_APP_URL` | `https://www.gulumen.com` | Publikus URL |
| `NEXTAUTH_URL` | `https://www.gulumen.com` | NextAuth callback base URL |
| `NEXTAUTH_SECRET` | min. 32 karakter (pl. `openssl rand -base64 32`) | Ha hiányzik, fallback: JWT_SECRET → ADMIN_API_KEY → beépített |
| `JWT_SECRET` | min. 16 karakter | Email/jelszó session (jose JWT) |
| `ADMIN_API_KEY` | erős random string | Admin belépés + auth fallback |
| `NODE_ENV` | `production` | Railway gyakran automatikusan beállítja |

**FONTOS:** A kulcs nevében **ne legyen szóköz** (pl. ` NEXTAUTH_SECRET` hibás). A Value mezőbe írd a titkot, ne a Name mezőbe.

### 4. Railway Variables – Google bejelentkezéshez

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Client Secret |

Google OAuth redirect URI a Google Console-ban: `https://www.gulumen.com/api/auth/callback/google`

### 5. PORT – ne állítsd kézzel

A **PORT** változót **ne** add hozzá manuálisan. Railway automatikusan beállítja (gyakran `8080`). A `scripts/start.js` ezt használja:

```
next start -H 0.0.0.0 -p $PORT
```

### 6. Miért volt NO_SECRET korábban?

Next.js 14 App Router **build-time** beégetheti a `process.env.NEXTAUTH_SECRET` értékét a bundle-be. Ha buildkor a változó hiányzik, runtime-ban `undefined` marad – még fallback ellenére is.

**Javítás a kódban (v5):**

- `readEnv(key)` – dinamikus kulcs, nem inline-olható buildkor
- `resolveNextAuthSecret()` – mindig ad titkot (beépített fallback is)
- `getAuthOptions()` – kérésenként frissül, `secret` közvetlenül a resolverből jön
- `next.config.js` – `serverComponentsExternalPackages: ['next-auth']`
- `scripts/bootstrap-auth-env.cjs` – Next.js indulása **előtt** beállítja a `process.env`-et
- Auth route: `dynamic = 'force-dynamic'`, `runtime = 'nodejs'`

### 7. Opcionális Variables

| Name | Mikor kell |
|------|------------|
| `STRIPE_SECRET_KEY` | Kártyás fizetés |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook |
| `PAYMENTS_WEBHOOK_SECRET` | Külső payment webhook |
| `OPENAI_API_KEY` | AI chat / voice |
| `RESEND_API_KEY` | Email küldés |

Részletes lista: [docs/RAILWAY_VARIABLES.md](docs/RAILWAY_VARIABLES.md)

---

## Stripe (kártyás fizetés)

- **Környezeti változók** (másold `.env.example` → `.env`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (pl. `http://localhost:3000`).
- **Dashboard**: [Stripe Dashboard](https://dashboard.stripe.com) → API keys, Webhooks. Webhook endpoint: `POST https://<domain>/api/stripe/webhook`, esemény: `checkout.session.completed` (opcionális: `payment_intent.payment_failed`). Kupon: hozz létre egy 5%-os Coupon-t (Products → Coupons), másold az ID-t → `STRIPE_COUPON_ID_5PERCENT` (ha nincs megadva, kupon nélkül megy a session).
- **Teszt**: Stripe Test mode, kártya `4242 4242 4242 4242`. Lokális webhook teszt: [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- **Rendelések**: Élesben Prisma + Postgres (Railway); táblák: `Order`, `OrderItem`, stb.
- **E-mail**: Opcionális `RESEND_API_KEY` + `EMAIL_FROM` – webhook után rendelés megerősítő e-mail.

## Features

- **UI**: Minimalist design, #FFFFFF / #111111 / #0EA5E9, Poppins + Inter, dark mode toggle in header
- **Pages**: Home (hero, categories, new/deals grid, trust strip, registration CTA), Shop (filters, 3-column grid), Product (gallery, price HUF+EUR, condition, stock, tabs: Leírás / Szállítás / Visszaküldés), Szállítás, Visszaküldés, Kapcsolat, Kosár, Profil, Regisztráció
- **AI Assistant** (bottom-right “Kérdésed van? Segítek!”): Replies in Hungarian, English, or German; handles product questions, payment, shipping (24–48h, free over 25k HUF), returns, authenticity (no certificate, transparent sourcing), complaints (order ID + email + description), registration/coupon. Never asks for card/ID/password; escalates on legal/aggressive/authenticity accusations

## Build

```bash
npm run build
npm start
```

`npm run build` futtatja a `prisma generate`-et, majd a `next build`-et. A seed (`scripts/seed-products.ts`) **start**-kor fut, nem buildkor.
