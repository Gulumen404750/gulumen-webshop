# Production checklist – deploy előtt

Biztonsági audit alapján a következők kötelezőek éles környezetben.

Irányelvek: [SECURITY.md](../SECURITY.md) (sebezhetőség-bejelentés) · [Admin biztonsági szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md) (üzemeltetés).

## Kötelező env változók

- **ADMIN_API_KEY** – Erős, véletlenszerű kulcs (pl. `openssl rand -hex 32`).  
  Admin sourcing success/fail végpontok (`/api/admin/sourcing/[orderId]/success`, `fail`) csak ezzel a headerrel (`x-admin-key`) fogadnak kérést. Ha nincs beállítva → 503.

- **PAYMENTS_WEBHOOK_SECRET** – Erős titok a payment webhook hitelesítéshez.  
  A külső rendszer a `X-Webhook-Secret` headerben küldi. Ha nincs beállítva → 503.

## Ellenőrizendő

- [ ] `ADMIN_API_KEY` generálva és a deploy környezetben beállítva (pl. Vercel / .env)
- [ ] Admin 2FA (Google Authenticator) bekapcsolva élesben — [szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md)
- [ ] `ADMIN_ALLOWED_IPS` ki van töltve élesben (üres = minden IP)
- [ ] `PAYMENTS_WEBHOOK_SECRET` beállítva a deploy környezetben
- [ ] Nincs hardcode-olt titok a kódban (csak `process.env.*`)
- [ ] Build ne bukjon env hiány miatt (a kritikus végpontok 503-at adnak, az alkalmazás elindul)

## Opcionális (ajánlott)

- [ ] `OPENAI_API_KEY` – ha az AI chat asszisztens valódi válaszokat ad
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` – kártyás fizetés
- [ ] `RESEND_API_KEY` – hírlevél / e-mail küldés

## .env.example

A repo `.env.example` fájlja üres placeholderokat tartalmaz (`ADMIN_API_KEY=`, `PAYMENTS_WEBHOOK_SECRET=`). A tényleges értékeket soha ne commitold; a `.env` szerepel a `.gitignore`-ban.
