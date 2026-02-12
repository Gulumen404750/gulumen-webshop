# Gulumen Webshop

Minimalist, premium ecommerce webshop – mixed products (bags, clothing, electronics, accessories) with AI customer assistant (HU/EN/DE).

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe (kártyás fizetés)

- **Környezeti változók** (másold `.env.example` → `.env`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (pl. `http://localhost:3000`).
- **Dashboard**: [Stripe Dashboard](https://dashboard.stripe.com) → API keys, Webhooks. Webhook endpoint: `POST https://<domain>/api/stripe/webhook`, esemény: `checkout.session.completed` (opcionális: `payment_intent.payment_failed`). Kupon: hozz létre egy 5%-os Coupon-t (Products → Coupons), másold az ID-t → `STRIPE_COUPON_ID_5PERCENT` (ha nincs megadva, kupon nélkül megy a session).
- **Teszt**: Stripe Test mode, kártya `4242 4242 4242 4242`. Lokális webhook teszt: [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- **Rendelések**: Fejlesztéshez a rendelések a `data/orders.json` fájlba kerülnek. **Élesben tilos** – használj Prisma + Postgres (Supabase, Neon, Railway); táblák: `order`, `order_items`, `payments`.
- **E-mail**: Opcionális `RESEND_API_KEY` + `EMAIL_FROM` – webhook után rendelés megerősítő e-mail (tétellista, szállítási idő, visszaküldés, kapcsolat).

## Features

- **UI**: Minimalist design, #FFFFFF / #111111 / #0EA5E9, Poppins + Inter, dark mode toggle in header
- **Pages**: Home (hero, categories, new/deals grid, trust strip, registration CTA), Shop (filters, 3-column grid), Product (gallery, price HUF+EUR, condition, stock, tabs: Leírás / Szállítás / Visszaküldés), Szállítás, Visszaküldés, Kapcsolat, Kosár, Profil, Regisztráció
- **AI Assistant** (bottom-right “Kérdésed van? Segítek!”): Replies in Hungarian, English, or German; handles product questions, payment, shipping (24–48h, free over 25k HUF), returns, authenticity (no certificate, transparent sourcing), complaints (order ID + email + description), registration/coupon. Never asks for card/ID/password; escalates on legal/aggressive/authenticity accusations

## Build

```bash
npm run build
npm start
```
