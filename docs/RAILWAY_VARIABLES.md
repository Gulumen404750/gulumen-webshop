# Railway Variables – production indításhoz

Ezeket a változókat állítsd be a **Railway → Project → Variables** felületen, hogy productionban biztosan elinduljon az alkalmazás.

---

## Kötelező (nélkülük 503 / auth nem működik)

| Változó | Példa / megjegyzés |
|--------|---------------------|
| **NODE_ENV** | `production` (Railway gyakran automatikusan beállítja) |
| **DATABASE_URL** | Postgres connection string. Pl. Railway Postgres: `postgresql://user:pass@host:5432/railway?sslmode=require` |
| **JWT_SECRET** | Legalább 16 karakter. Pl. generálás: `openssl rand -hex 32` |
| **ADMIN_API_KEY** | **Név (Railway Name):** `ADMIN_API_KEY` – ne töröld. **Érték (Value – hova írod):** a generált titkos kulcs (pl. `openssl rand -hex 32`). Részletesen: [Admin API kulcs beállítása](ADMIN-API-KULCS-BEALLITAS.md) |
| **NEXT_PUBLIC_APP_URL** | Az alkalmazás publikus URL-je. Pl. `https://www.gulumen.com` |
| **NEXTAUTH_SECRET** | NextAuth JWT titok. Ha nincs megadva, a kód **JWT_SECRET** vagy **ADMIN_API_KEY** értékét használja fallbackként. Élesben érdemes külön generálni: `openssl rand -base64 32` |
| **NEXTAUTH_URL** | Pl. `https://www.gulumen.com`. Ha nincs megadva, **NEXT_PUBLIC_APP_URL** lesz használva. |

---

## Kötelező, ha használod a funkciót

| Változó | Mikor kell |
|--------|-------------|
| **STRIPE_SECRET_KEY** | Ha kártyás fizetés (Stripe) van – élesben `sk_live_...` |
| **STRIPE_WEBHOOK_SECRET** | Ha Stripe webhook van – Dashboard → Webhooks → Signing secret |
| **PAYMENTS_WEBHOOK_SECRET** | Ha a `/api/payments/webhook` végpontot használod (külső fizetési provider) |

---

## Opcionális (emails, AI, analytics, stb.)

| Változó | Használat |
|--------|-----------|
| RESEND_API_KEY | Email küldés (rendelés, newsletter, callback, voice summary) |
| ADMIN_EMAIL | Címzett a callback/voice emailnek |
| EMAIL_FROM / RESEND_FROM | Feladó cím (alap: `Gulumen <noreply@gulumen.com>`) |
| OPENAI_API_KEY | AI chat / voice asszisztens |
| VOICE_AGENT_WEBHOOK_SECRET | Voice agent webhook biztonság |
| CALLBACK_WEBHOOK_URL | Callback kérés külső webhook URL |
| FX_HUF_PER_EUR | Hűségkedvezmény küszöb (pl. `390`) |
| STRIPE_COUPON_ID_5PERCENT | Stripe kupon ID (5% kedvezmény) |
| NEXT_PUBLIC_SUPPORT_PHONE | Telefonszám a „Hívj minket” CTA-n |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | Google Analytics 4 |
| TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID | Telegram értesítések |
| SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT | Sentry (build-time is: next.config.js) |
| NEXT_PUBLIC_SENTRY_DSN | Sentry kliens oldal |
| CRON_SECRET | Cron route védelméhez (`/api/cron/*`) |
| NEXTAUTH_SECRET | Production fail-fast – min. 16 karakter (Google/NextAuth) |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL (elosztott rate limit + idempotency) |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token |
| LOG_LEVEL | Pl. `info` vagy `debug` |

### Railway Cron (külső / platform cron)

A `vercel.json` cron Railway-en nem fut. Állíts be külső cron-t (vagy Railway Cron Job-ot), amely `Authorization: Bearer $CRON_SECRET` headerrel hívja:

| Endpoint | Javasolt ütemezés |
|----------|-------------------|
| `GET /api/cron/process-outbox` | minden 5 perc |
| `GET /api/cron/cleanup-stuck-payments` | minden 10 perc |
| `GET /api/cron/data-retention` | naponta 03:00 |

---

## PORT

A **PORT**-ot ne állítsd be kézzel – a Railway automatikusan beállítja. A `scripts/start.js` ezt használja (vagy 3000 lokálisan).

---

## Rövid checklist – minimum ahhoz, hogy elinduljon

1. **DATABASE_URL** – Postgres URL (Railway Postgres vagy külső)
2. **JWT_SECRET** – legalább 16 karakter
3. **ADMIN_API_KEY** – admin belépéshez
4. **NEXT_PUBLIC_APP_URL** – pl. `https://www.gulumen.com`
5. **NODE_ENV** – `production` (ha Railway nem állítja)

Ha ezek megvannak, az alkalmazás el tud indulni. Stripe, email, AI stb. opcionális; hiányuk nem akadályozza meg az indulást.

---

## Migráció (Postgres)

Ha van **DATABASE_URL** és Prisma migrációk: a deploy után egyszer futtasd (Railway CLI vagy one-off job):

```bash
npx prisma migrate deploy
```
