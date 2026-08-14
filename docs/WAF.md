# Cloudflare WAF az admin előtt

Az appnak **nincs** beépített WAF-ja, és szándékosan nem is kapott új middleware-t: az IP-lista (`ADMIN_ALLOWED_IPS`) és a login/TOTP rate limit már a Next.js middleware / API-ban megvan. Duplikálni edge-en **ugyanazt** a listát a kódban felesleges.

A WAF a **Cloudflare proxyn** van, **az origin (Railway) előtt**. Csak az admin felületet szűri. A publikus shop (`/termekek`, kosár, checkout, `/api/auth`) **kimarad**.

Railway TLS önmagában nem WAF.

---

## Előfeltétel

1. `gulumen.com` és `www.gulumen.com` DNS **orange-cloud** (Proxied) a Cloudflare-ben.
2. SSL/TLS mód: **Full (strict)**.
3. A Railway origin **ne** legyen publikus admin-URL-ként hirdetve (csak a Cloudflare host).
4. Jegyezd fel az `ADMIN_URL_SLUG` értékét (Railway Variables). Ha üres, a belépés `/admin/login`. A slug **nem** lehet shop-útvonal (`termekek`, `fizetes`, `auth`, …).

A lenti kifejezésekben cseréld:

| Placeholder | Példa |
|-------------|--------|
| `SLUG` | `a1b2c3d4e5f6` (az `ADMIN_URL_SLUG`, **leading slash nélkül**) |

Ha **nincs** slug, a `SLUG` blokkokat hagyd ki (csak `/admin` + `/api/admin`).

---

## Mit NE kapcsolj be zóna-szinten

Ezek a shopot (checkout, belépés, webhook) is ütik:

- **I'm Under Attack Mode** (egész zóna)
- **Bot Fight Mode** (Free, egész zóna) skip szabály nélkül
- **Cloudflare Access** az egész `www.gulumen.com`-ra (csak path-os Application, lásd §5)

A botvédelem **path-szűrt custom rule** legyen (lent A3), ne globális Bot Fight.

---

## Útvonal-halmazok (másold a kifejezésbe)

### Admin (védendő)

```
(http.request.uri.path eq "/admin") or
starts_with(http.request.uri.path, "/admin/") or
(http.request.uri.path eq "/api/admin") or
starts_with(http.request.uri.path, "/api/admin/") or
(http.request.uri.path eq "/SLUG") or
starts_with(http.request.uri.path, "/SLUG/") or
(http.request.uri.path eq "/api/SLUG") or
starts_with(http.request.uri.path, "/api/SLUG/")
```

A `starts_with(..., "/admin/")` szándékos: **nem** egyezik pl. egy kitalált `/administrator` shop-path-szel.

### Shop / checkout / auth (TILOS challenge-elni)

```
(http.request.uri.path eq "/termekek") or
starts_with(http.request.uri.path, "/termekek/") or
starts_with(http.request.uri.path, "/termek/") or
starts_with(http.request.uri.path, "/kosar") or
starts_with(http.request.uri.path, "/fizetes") or
starts_with(http.request.uri.path, "/regisztracio") or
starts_with(http.request.uri.path, "/profil") or
starts_with(http.request.uri.path, "/kedvencek") or
starts_with(http.request.uri.path, "/api/auth") or
starts_with(http.request.uri.path, "/api/checkout") or
starts_with(http.request.uri.path, "/api/cart") or
starts_with(http.request.uri.path, "/api/me") or
starts_with(http.request.uri.path, "/api/products") or
starts_with(http.request.uri.path, "/api/stripe") or
starts_with(http.request.uri.path, "/api/payments") or
starts_with(http.request.uri.path, "/api/cron") or
starts_with(http.request.uri.path, "/api/health") or
starts_with(http.request.uri.path, "/api/newsletter") or
starts_with(http.request.uri.path, "/api/orders") or
starts_with(http.request.uri.path, "/api/gamification") or
starts_with(http.request.uri.path, "/api/chat")
```

Webhookok (Stripe / payments / cron) **soha** ne kapjanak JS challenge-et — a Stripe szerver nem oldja meg a captchát.

---

## 1. Custom WAF szabályok

Dashboard: **Security → Security rules → Custom rules** → Create rule → *Edit expression*.

Sorrend (priority): előbb a **Skip webhook**, aztán az admin challenge. A shopra **ne** tegyél Block/Challenge szabályt.

### A0 — Skip: webhook + cron (legmagasabb priorítás)

| Mező | Érték |
|------|--------|
| Rule name | `skip-webhooks-cron` |
| Action | **Skip** |
| WAF components to skip | Bot Fight Mode, Rate limiting, Custom rules (a többi WAF; **ne** skippelj mindent zónára) |

Expression:

```
starts_with(http.request.uri.path, "/api/stripe/") or
starts_with(http.request.uri.path, "/api/payments/") or
starts_with(http.request.uri.path, "/api/cron/") or
(http.request.uri.path eq "/api/health") or
starts_with(http.request.uri.path, "/api/health/")
```

Ha a Skip UI-ban komponensenként lehet választani: legalább **Bot Fight** + **Managed Challenge**. A cél, hogy a Stripe POST átmenjen.

### A1 — Managed Challenge az admin UI + login API-n

| Mező | Érték |
|------|--------|
| Rule name | `admin-managed-challenge` |
| Action | **Managed Challenge** |

Expression (slug nélkül):

```
(http.request.uri.path eq "/admin") or
starts_with(http.request.uri.path, "/admin/") or
(http.request.uri.path eq "/api/admin/login") or
starts_with(http.request.uri.path, "/api/admin/2fa/")
```

Expression (`ADMIN_URL_SLUG` be van állítva — **ezt használd élesben**):

```
(http.request.uri.path eq "/admin") or
starts_with(http.request.uri.path, "/admin/") or
(http.request.uri.path eq "/api/admin/login") or
starts_with(http.request.uri.path, "/api/admin/2fa/") or
(http.request.uri.path eq "/SLUG") or
starts_with(http.request.uri.path, "/SLUG/") or
(http.request.uri.path eq "/api/SLUG/login") or
starts_with(http.request.uri.path, "/api/SLUG/2fa/")
```

Ez a böngészős belépést challenge-eli. **Ne** tedd az egész `/api/admin/*`-re, ha van gépi `x-admin-key` sourcing hívás (`/api/admin/sourcing/...` vagy `/api/SLUG/sourcing/...`) — a script nem oldja a challenge-et.

### A2 — Block ismert rossz UA az admin path-en (opcionális)

| Mező | Érték |
|------|--------|
| Rule name | `admin-block-scanners` |
| Action | **Block** |

```
(
  (http.request.uri.path eq "/admin") or
  starts_with(http.request.uri.path, "/admin/") or
  starts_with(http.request.uri.path, "/api/admin/") or
  (http.request.uri.path eq "/SLUG") or
  starts_with(http.request.uri.path, "/SLUG/") or
  starts_with(http.request.uri.path, "/api/SLUG/")
)
and (
  http.user_agent contains "sqlmap" or
  http.user_agent contains "nikto" or
  http.user_agent contains "masscan"
)
```

### A3 — Bot score csak adminon (Pro / Bot Management)

Free terven a `cf.bot_management.score` nincs. Pro+:

| Mező | Érték |
|------|--------|
| Rule name | `admin-bot-score-challenge` |
| Action | **Managed Challenge** |

```
(
  (http.request.uri.path eq "/admin") or
  starts_with(http.request.uri.path, "/admin/") or
  starts_with(http.request.uri.path, "/api/admin/") or
  (http.request.uri.path eq "/SLUG") or
  starts_with(http.request.uri.path, "/SLUG/") or
  starts_with(http.request.uri.path, "/api/SLUG/")
)
and not starts_with(http.request.uri.path, "/api/admin/sourcing/")
and not starts_with(http.request.uri.path, "/api/SLUG/sourcing/")
and cf.bot_management.score lt 30
```

Ha mégis **Super Bot Fight Mode**-ot kapcsolsz (Pro): állítsd *Definitely automated = Block*, de adj **Skip Bot Fight** szabályt a shop kifejezésre (§ Útvonal-halmazok, shop). Globális Bot Fight a Free-n `/api/auth` és checkoutot is captcházhat.

---

## 2. Rate limiting szabályok

Dashboard: **Security → Security rules → Rate limiting rules**.

Az app login limite: **5 POST / 10 perc / IP** (`adminLogin`), TOTP **10 / 10 perc**. Az edge limit legyen **szűkebb a floodra, de ne szűkebb az appnál** a normál belépéshez — különben a WAF 429-ez, mielőtt a lockout/captcha lefutna.

### R1 — Admin login POST (másolható)

| Mező | Érték |
|------|--------|
| Rule name | `rl-admin-login` |
| If incoming requests match | expression lent |
| With the same | **IP** |
| Then | **Block** for 10 minutes |
| Requests | **8** |
| Period | **10 minutes** |

Expression:

```
(http.request.method eq "POST") and (
  http.request.uri.path eq "/api/admin/login" or
  http.request.uri.path eq "/api/admin/2fa/verify-login" or
  http.request.uri.path eq "/api/admin/2fa/verify-setup" or
  http.request.uri.path eq "/api/SLUG/login" or
  http.request.uri.path eq "/api/SLUG/2fa/verify-login" or
  http.request.uri.path eq "/api/SLUG/2fa/verify-setup"
)
```

8 / 10 perc > app 5 / 10 perc: a captcha + lockout még lefut; a brute-force flood az origin előtt megáll.

### R2 — Admin API általános (dashboard klikkelés ne essen ki)

| Mező | Érték |
|------|--------|
| Rule name | `rl-admin-api` |
| Then | **Managed Challenge** |
| Requests | **120** |
| Period | **1 minute** |
| Characteristic | **IP** |

```
starts_with(http.request.uri.path, "/api/admin/") or
starts_with(http.request.uri.path, "/api/SLUG/")
```

**Ne** alkalmazd `/api/auth`, `/api/checkout`, `/api/products` útvonalakra.

### R3 — Admin UI GET flood

| Mező | Érték |
|------|--------|
| Rule name | `rl-admin-ui` |
| Then | **Managed Challenge** |
| Requests | **60** |
| Period | **10 seconds** |
| Characteristic | **IP** |

```
(http.request.uri.path eq "/admin") or
starts_with(http.request.uri.path, "/admin/") or
(http.request.uri.path eq "/SLUG") or
starts_with(http.request.uri.path, "/SLUG/")
```

---

## 3. Bot Fight — csak path-szűrten

| Terv | Teendő |
|------|--------|
| **Free** | **Ne** kapcsold a zóna-szintű Bot Fight Mode-ot. Használd az **A1** Managed Challenge-et admin path-re. |
| **Pro Super Bot Fight** | Definitely automated → Block. Adj Skip-et a **shop** kifejezésre (Bot Fight komponens). Admin path-en hagyhatod. |
| **Bot Management** | **A3** (`cf.bot_management.score lt 30`) csak adminon. |

Ellenőrzés: inkognitóban `/termekek` és egy termék kosárba → **nincs** Cloudflare challenge. `/api/auth/login` POST (shop user) → **nincs** challenge.

---

## 4. Opcionális: Cloudflare Access (Zero Trust)

Csak a **böngészős admin UI**-ra. Nem helyettesíti a `ADMIN_API_KEY` + 2FA-t; egy réteg *előtte*.

**Ne** tedd Access mögé:

- a teljes zónát
- `/api/auth`, `/api/checkout`, `/termekek`
- `/api/admin/sourcing/*` vagy `/api/SLUG/sourcing/*` (gépi `x-admin-key`), hacsak nincs Access **Service Token** a hívóban

### Lépések

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Access → Applications → Add an application → Self-hosted**.
2. Application name: `Gulumen Admin UI`.
3. Public hostname:
   - Domain: `www.gulumen.com`
   - Path: `SLUG` → a UI `www.gulumen.com/SLUG*` (vagy `/admin*`, ha nincs slug).
4. Ha a kanonikus `/admin*` még létezik (redirect/404): külön Application path `/admin*`, ugyanazzal a policyval — vagy hagyd a Next 404-re, Access nélkül.
5. Policy: **Allow** → Include → **Emails** (üzemeltetői címek) vagy Google / One-time PIN.
6. Session: 24h elég; az app JWT rövidebb is lehet.
7. **Bypass** policy **nincs** a shop path-ekre — azokra **ne** hozz létre Applicationt.

API Access: ha később az `/api/SLUG/*` dashboard XHR-t is véded, a böngésző Access cookie-ja kell (ugyanaz az origin). A sourcing scripthez: Zero Trust → **Service Auth** → Service Token, header `CF-Access-Client-Id` / `CF-Access-Client-Secret`.

---

## 5. Mit hagy a kód (ne duplikáld)

| Réteg | Hol | Szerep |
|-------|-----|--------|
| IP allowlist | `ADMIN_ALLOWED_IPS`, `src/lib/admin-ip-allowlist.ts` | Origin: csak listázott IP. A WAF **nem** másolja ezt a listát. |
| Login rate limit | `rateLimit` preset `adminLogin` (5 / 10 perc) | Origin. WAF R1 enyhébb flood-kapu. |
| TOTP rate limit | preset `adminTotp` | Origin. |
| Rejtett URL | `ADMIN_URL_SLUG` | Origin 404 `/admin`-ra session nélkül. A WAF a slug path-et is védje. |
| CSRF, 2FA, session | middleware + `/api/admin/*` | Origin. |

A Cloudflare **Custom IP Access Rule** (allow iroda / block country) opcionális **kiegészítés**, ha az `ADMIN_ALLOWED_IPS` üresen maradna — de élesben az origin listát akkor is töltsd ki ([szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md) §3).

---

## 6. Ellenőrzőlista (deploy nélkül, Dashboard)

- [ ] Orange-cloud + Full (strict)
- [ ] A0 Skip webhook/cron
- [ ] A1 Managed Challenge admin UI + login/2FA API (`SLUG` behelyettesítve)
- [ ] R1 login rate limit, R2/R3 laza admin limit
- [ ] **Nincs** zóna-szintű Under Attack / Free Bot Fight
- [ ] Shop: `/termekek`, kosár, `/fizetes`, `/api/auth` challenge nélkül
- [ ] Stripe webhook teszt (Dashboard → Webhooks → Send test) 2xx, nem HTML challenge
- [ ] Admin: `https://www.gulumen.com/SLUG/login` → Cloudflare challenge, aztán a Gulumen login
- [ ] (Opcionális) Access csak `SLUG*` UI-ra

Nincs Railway deploy ehhez a doksihoz: a szabályok a Cloudflare fiókban élnek.
