# Gulumen Webshop

Minimalist, premium ecommerce webshop – mixed products (bags, clothing, electronics, accessories) with AI customer assistant (HU/EN/DE).

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **UI**: Minimalist design, #FFFFFF / #111111 / #0EA5E9, Poppins + Inter, dark mode toggle in header
- **Pages**: Home (hero, categories, new/deals grid, trust strip, registration CTA), Shop (filters, 3-column grid), Product (gallery, price HUF+EUR, condition, stock, tabs: Leírás / Szállítás / Visszaküldés), Szállítás, Visszaküldés, Kapcsolat, Kosár, Profil, Regisztráció
- **AI Assistant** (bottom-right “Kérdésed van? Segítek!”): Replies in Hungarian, English, or German; handles product questions, payment, shipping (24–48h, free over 25k HUF), returns, authenticity (no certificate, transparent sourcing), complaints (order ID + email + description), registration/coupon. Never asks for card/ID/password; escalates on legal/aggressive/authenticity accusations

## Build

```bash
npm run build
npm start
```
