# Production checklist – deploy előtt

Biztonsági audit alapján a következők kötelezőek éles környezetben.

Irányelvek: [SECURITY.md](../SECURITY.md) (sebezhetőség-bejelentés) · [Admin biztonsági szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md) (üzemeltetés).

## Kötelező env változók

- **ADMIN_API_KEY** – Erős, véletlenszerű kulcs (pl. `openssl rand -hex 32`).  
  Admin sourcing success/fail végpontok (`/api/admin/sourcing/[orderId]/success`, `fail` vagy rejtett slug mellett `/api/<ADMIN_URL_SLUG>/sourcing/...`) `x-admin-key` headerrel is fogadnak kérést. Ha nincs beállítva → 503.

- **ADMIN_URL_SLUG** – Ajánlott. Véletlen útvonal (8–64 karakter, pl. `openssl rand -hex 8`).  
  Belépés: `https://<domain>/<slug>/login`. A nyilvános `/admin` és `/api/admin` session nélkül 404.  
  Sourcing capture: `/api/<slug>/sourcing/...` (a régi `/api/admin/sourcing/...` csak `x-admin-key`-vel marad elérhető).

- **ADMIN_ALLOWED_IPS** – Irodai / VPN kimenő IPv4 vagy CIDR, vesszővel. **Productionben üresen 403** a `/admin`, `/api/admin/*` és a rejtett `/{ADMIN_URL_SLUG}` felületen (lockout).  
  Railway: Name `ADMIN_ALLOWED_IPS`, Value pl. `203.0.113.10,10.8.0.0/24`. A kimenő címed: `curl -4 ifconfig.me`.

- **PAYMENTS_WEBHOOK_SECRET** – Erős titok a payment webhook hitelesítéshez.  
  A külső rendszer a `X-Webhook-Secret` headerben küldi. Ha nincs beállítva → 503.

## Ellenőrizendő

- [ ] `ADMIN_API_KEY` generálva és a deploy környezetben beállítva (pl. Vercel / .env)
- [ ] Admin 2FA (Google Authenticator) bekapcsolva élesben — [szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md)
- [ ] `ADMIN_ALLOWED_IPS` ki van töltve élesben (üres productionben = 403 / lockout; példa: `203.0.113.10,10.8.0.0/24`)
- [ ] `ADMIN_URL_SLUG` beállítva (rejtett belépési URL; `/admin` session nélkül 404)
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` élesben (admin rate limit + JWT denylist több példányon)
- [ ] `PAYMENTS_WEBHOOK_SECRET` beállítva a deploy környezetben
- [ ] Nincs hardcode-olt titok a kódban (csak `process.env.*`)
- [ ] Build ne bukjon env hiány miatt (a kritikus végpontok 503-at adnak, az alkalmazás elindul)

## Opcionális (ajánlott)

- [ ] `OPENAI_API_KEY` – ha az AI chat asszisztens valódi válaszokat ad
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` – kártyás fizetés
- [ ] `RESEND_API_KEY` – hírlevél / e-mail küldés **és** admin anomália-riasztás
- [ ] `ADMIN_EMAIL` – gyanús belépés / fiókzárolás + nagy CSV / tömeges ár / burst törlés riasztás (+ callback)
- [ ] `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` – reCAPTCHA v3 a belépésnél
- [ ] Railway Postgres backup / [BACKUP.md](BACKUP.md)
- [ ] Cloudflare WAF az admin előtt (path challenge + login rate limit; shop / webhook skip) — [docs/WAF.md](WAF.md)
- [ ] Admin / auth kód: először **staging** (`gulumen-webshop-staging`, saját `ADMIN_API_KEY` / `JWT_SECRET` / DB), utána `master` → www — [docs/STAGING.md](STAGING.md)

## .env.example

A repo `.env.example` fájlja üres placeholderokat tartalmaz (`ADMIN_API_KEY=`, `PAYMENTS_WEBHOOK_SECRET=`). A tényleges értékeket soha ne commitold; a `.env` szerepel a `.gitignore`-ban.
