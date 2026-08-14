# WAF / DDoS a `/admin` előtt

Az appnak nincs beépített WAF-ja. A login rate limit (5 / 10 perc, Redis-szel instance-független) nem DDoS-védelem.

## Ajánlott

- A `gulumen.com` / `www.gulumen.com` DNS-e **Cloudflare** (vagy vele egyenértékű) proxyn menjen, orange-cloud.
- WAF szabály: `/admin*`, `/api/admin*`, és ha van `ADMIN_URL_SLUG`, a `/{slug}*` útvonal bot-challenge / rate limit.
- Cloudflare Access / Zero Trust a rejtett admin slugra, ha van Google Workspace / e-mail OTP.

Railway edge TLS önmagában nem WAF.
