# Staging

Az éles Railway (`www.gulumen.com`) a `main` / `master` pushra megy. Admin / auth változást **ne** először élesben próbálj.

## Ajánlott

1. Railway-n külön service: `gulumen-webshop-staging` (más domain, pl. `staging.gulumen.com`).
2. Saját Postgres (ne az éles `DATABASE_URL`).
3. Saját `ADMIN_API_KEY`, `JWT_SECRET`, `ADMIN_URL_SLUG`, `ADMIN_ALLOWED_IPS`.
4. GitHub Environment: staging deploy a `cursor/*` PR-ekre vagy egy `staging` ágra; production csak `main`/`master`.

A CI (lint, unit, e2e) minden PR-en lefut — ez nem helyettesíti a staging admin belépés kézi próbáját (2FA, IP-lista, rejtett slug).
