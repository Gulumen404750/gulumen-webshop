# Login rate limit – teszt / curl

## Követelmény

- Max **10 sikertelen** kísérlet / **10 perc** / IP (rate limit).
- **Fiókzárolás:** létező userre 10 hibás jelszó (IP-től függetlenül) → 15 perc `lockedUntil` a User rekordon. 429 body: `{ "error": "Too many login attempts. Try again later.", "locked": true, "retryAfterSec": N }` + `Retry-After` header.
- Zároláskor **egyszeri e-mail** az `ADMIN_EMAIL` címre (ha van `RESEND_API_KEY`).
- Sikeres login után a failed számláló **és** a zár **nullázódik**.

## Reproducible curl teszt

Futtasd a dev szervert (`npm run dev`), majd:

### 1) 429 elérése (11. sikertelen kísérlet)

```bash
# 11x hibás jelszó (vagy nem létező email) – ugyanazzal az IP-vel
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

Várható: az első 10 kérés **401**, a 11. **429**. Body ellenőrzés a 11.-re:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' | jq .
# Várható: { "error": "Too many login attempts. Try again later." }
```

### 2) Sikeres login nullázza a számlálót

Ha limit után **sikeresen** bejelentkezel (pl. helyes email+jelszó), a következő sikertelen kísérletek ismét 401-et adnak (a számláló nullázódott). Tehát:

1. Érd el a 429-et (11 sikertelen).
2. Küldj egy **sikeres** login kérést (érvényes user).
3. Küldj ismét 1 sikertelen kérést → **401** (nem 429), mert a sikeres login resetelte a countert.

### 3) Ablak (10 perc) után újra próbálkozás

10 perc után ugyanazzal az IP-vel ismét 10 sikertelen lehet (az ablak lejárta miatt).

## Log

Limit elérésekor a szerver **warn** szinten logol (pino/sentry), pl.:

`Login rate limit exceeded` + `ip`, `failedCount`.
