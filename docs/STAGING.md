# Staging gate – admin/auth ne menjen egyből a www.gulumen.com-ra

Ez a dokumentum **üzemeltetői lépéseket** ír le. A repo **nem** kapcsolja ki az éles deployt, és **nem** hozza létre magától a Railway staging service-t.

## Ami változatlan marad (éles)

| | Érték | Ne nyúlj hozzá |
|--|--------|----------------|
| Railway service | **`gulumen-webshop`** | Ne nevezd át, ne cseréld a Source branchet `staging`-re |
| Domain | **`https://www.gulumen.com`** | Ne pontold stagingre |
| GitHub Source branch | **`master`** | Push a `master`-re továbbra is éles deploy |
| Opcionális CLI | [`.github/workflows/railway-deploy.yml`](../.github/workflows/railway-deploy.yml) | `on.push.branches: [master, main]` + `railway up --service gulumen-webshop` |

A `main` push is elindíthatja a **CLI** jobot (ha van `RAILWAY_TOKEN`), de a Railway Dashboard Source-ja a **`master`**. A kettőt **ne** keverd: az éles oldal akkor frissül, ha a **`gulumen-webshop`** Source ágára megy a commit.

**Tilos** (ez állítaná le / térítené el az éles oldalt):

- `gulumen-webshop` → Settings → Source → branch átállítása `staging`-re vagy feature ágra
- `railway-deploy.yml` triggereiből a `master` / `main` törlése
- `--service gulumen-webshop` átírása más névre
- production `DATABASE_URL` / `ADMIN_API_KEY` / `JWT_SECRET` másolása stagingre (vagy fordítva)
- a `dynamic-perfection` service használata (az **nem** a webshop, és **nem** staging)

---

## Cél

Admin / auth változás először egy **külön** Railway service-en (`gulumen-webshop-staging`) fusson, saját adatbázissal és saját titkokkal. Csak utána merge a `main` / `master` ágra, ahonnan a `www.gulumen.com` jön.

Két, egymást kiegészítő kapu:

1. **Railway staging service** + git ág `staging` (tényleges izoláció).
2. **GitHub Environment** `staging` (opcionális reviewer a CLI jobhoz). Üres environment = nincs várakozás.

---

## 1. Egyszeri: `staging` git ág

A `staging` ág **nincs** a repo default ágai között; te hozod létre, amikor a Railway service kész (vagy előtte).

```bash
git fetch origin
# Az éles Source a master; a GitHub default gyakran a main.
# Indulj onnan, ami a www.gulumen.com-on van (általában origin/master):
git checkout -B staging origin/master
git push -u origin staging
```

Ha a `main` előrébb tart, mint a `master`, és a PR-eket a `main`-re merge-elitek:

```bash
git checkout -B staging origin/main
git push -u origin staging
```

Ez a push **nem** megy a `www.gulumen.com`-ra, ha a `gulumen-webshop` Source branch-e `master` marad.

---

## 2. Railway: új service (ne az éles!)

Ugyanabban a Railway **projektben**, ahol a `gulumen-webshop` van:

1. Railway Dashboard → a projekt (Gulumen).
2. **New** → **GitHub Repo** (ugyanaz: `Gulumen404750/gulumen-webshop`).
3. Service név: **`gulumen-webshop-staging`** (pontosan így, hogy a CLI workflow rátaláljon).
4. Settings → **Source**:
   - Repository: `Gulumen404750/gulumen-webshop`
   - Branch: **`staging`** (nem `master`, nem `main`)
   - Root Directory: üres vagy `.`
5. Settings → **Networking**: Generate Domain (pl. `*.up.railway.app`), vagy később `staging.gulumen.com` CNAME. **Ne** add hozzá a `www.gulumen.com`-ot.
6. Build / Start: hagyd a repo `railway.json` / `nixpacks.toml` értékeit (`npm run build` / `npm run start`).

Ellenőrzés: a **gulumen-webshop** service Source branch-e továbbra is **`master`**, domainje `www.gulumen.com`.

---

## 3. Saját Postgres (kötelező)

Az éles rendeléseket / usereket **ne** lásd stagingről.

1. Railway → **New** → **Database** → PostgreSQL (új instance, ne a production plugint).
2. A **staging** service Variables-ben: **Add variable** → **Add reference** → az **új** Postgres `DATABASE_URL`-je.
3. A production `DATABASE_URL`-t **ne** másold át. A két connection string hostja / userje / adatbázisneve különbözzön.
4. Első sikeres deploy után a `scripts/start.js` lefutja a `prisma migrate deploy`-t. Ha a start logban migrate hiba van, one-off:

   ```bash
   # Railway Dashboard → gulumen-webshop-staging → Settings → one-off / shell
   npx prisma migrate deploy
   ```

Seed **nem** kötelező. Ha kell teszttermék: `ALLOW_PRODUCT_SEED=1 npm run seed:products` **csak** a staging service-en (soha productionön rutinból).

---

## 4. Saját titkok – ne a production értékei

Minden értéket **újra generálj**. A production `ADMIN_API_KEY` / `JWT_SECRET` stagingre másolva azt jelenti, hogy egy staging szivárgás kilépteti / kinyitja az éles admint.

Generálás (lokális gép, ne commitold):

```bash
openssl rand -hex 32    # ADMIN_API_KEY
openssl rand -hex 32    # JWT_SECRET
openssl rand -base64 32 # NEXTAUTH_SECRET
openssl rand -hex 8     # ADMIN_URL_SLUG
openssl rand -hex 32    # CRON_SECRET (ha cron kell stagingen)
openssl rand -hex 32    # PAYMENTS_WEBHOOK_SECRET (ha webhookot tesztelsz)
```

Railway → **gulumen-webshop-staging** → **Variables** (service-szint, ne shared a productionnel):

| Name | Staging érték |
|------|----------------|
| `NODE_ENV` | `production` (a Next production build; ez nem „éles shop”) |
| `DATABASE_URL` | **Reference** az új Postgresre |
| `ADMIN_API_KEY` | az imént generált hex, **nem** a www kulcsa |
| `JWT_SECRET` | új, ≥16 karakter |
| `NEXTAUTH_SECRET` | új, külön a JWT-től |
| `NEXT_PUBLIC_APP_URL` | a staging host, pl. `https://<service>.up.railway.app` vagy `https://staging.gulumen.com` |
| `NEXTAUTH_URL` | ugyanaz, mint `NEXT_PUBLIC_APP_URL` |
| `ADMIN_URL_SLUG` | új slug (ne a production slug) |
| `ADMIN_ALLOWED_IPS` | a tesztelő iroda/VPN IP-je; üresen minden IP bejut – stagingen is töltsd ki, ha a service publikus |
| `CRON_SECRET` | új, ha cron route-ot hívsz |
| Stripe | **test** kulcsok (`sk_test_…`, `whsec_…`), ne `sk_live_` |
| `ADMIN_EMAIL` | a te címed a riasztásokhoz |

Részletes prod lista: [RAILWAY_VARIABLES.md](RAILWAY_VARIABLES.md). Stagingen a nem használt opcionális kulcsokat hagyd üresen.

Belépés stagingre: `https://<staging-host>/<ADMIN_URL_SLUG>/login` a **staging** `ADMIN_API_KEY`-vel. A www kulcsa itt 401.

---

## 5. GitHub Environment (opcionális védelem)

GitHub → repo → **Settings** → **Environments** → **New environment**.

### `staging`

1. Név: **`staging`** (ez egyezik a [railway-staging.yml](../.github/workflows/railway-staging.yml) `environment:` mezőjével).
2. Opcionális: **Required reviewers** (1 fő), **Wait timer**.
3. Environment secret (opcionális): `RAILWAY_TOKEN` vagy `RAILWAY_TOKEN_STAGING` – project token, amivel a `gulumen-webshop-staging` deployolható.

Üres environment = a CLI job azonnal fut. A Railway **Source** a `staging` ágra akkor is deployol, ha a GitHub Environment reviewerre vár — a reviewer csak a **Actions CLI** jobot fogja.

### `production` (csak akkor, ha érted a korlátot)

A [railway-deploy.yml](../.github/workflows/railway-deploy.yml) **szándékosan nem** használ `environment: production`-t. Ha később rárakod:

- a GitHub Actions CLI várhat reviewerre,
- a Railway Dashboard **Source** (`master` → `gulumen-webshop`) **akkor is azonnal** deployol.

Amíg a Source auto-deploy be van kapcsolva, a production Environment **nem** kapu a `www.gulumen.com` felé. Ne kapcsold be a required reviewert hamis biztonságérzet miatt. Ha CLI + Source is kapuzott kell, előbb a Railway Source-on állítsd a waitet / kapcsold ki az auto-deployt — ezt **ne** tedd anélkül, hogy tudnád, hogy az éles oldal ettől nem frissül pushra.

---

## 6. Opcionális CLI: `RAILWAY_TOKEN`

Ugyanaz a minta, mint élesben: token nélkül a workflow **nem bukik**, csak kihagyja a `railway up`-ot. A Railway Source akkor is deployol.

1. Railway → projekt → **gulumen-webshop-staging** (vagy a projekt) → Settings → **Tokens** → Create project token.
2. GitHub → Settings → Secrets and variables → Actions:
   - `RAILWAY_TOKEN_STAGING` (ajánlott, külön a prod token-től), **vagy**
   - a meglévő `RAILWAY_TOKEN` (project token mindkét service-re jó).
3. Push a `staging` ágra → [railway-staging.yml](../.github/workflows/railway-staging.yml) → `railway up --service gulumen-webshop-staging`.

Ez a workflow **soha** nem hívja a `gulumen-webshop` service-t.

---

## 7. Napi folyamat (admin / auth PR)

1. Feature ág, PR **először** a `staging` ágra (base: `staging`), vagy merge a `staging`-re.
2. Várd meg a `gulumen-webshop-staging` deployt. CI (`ci.yml`) a PR-en fusson zöldre.
3. Teszteld a staging URL-en: login, 2FA, IP-lista, CSRF, a konkrét admin/auth változás.
4. Ha jó: PR `staging` → `main` (GitHub default), majd ha a Railway Source `master`, merge / fast-forward **`main` → `master`**, hogy a www megkapja.
5. A [staging-gate-notice.yml](../.github/workflows/staging-gate-notice.yml) admin/auth path-os PR-nél `main`/`master` felé **figyelmeztetést** ír (nem bukik a CI).

Shop-only (termék, CSS) mehet tovább közvetlenül `main`/`master` felé, ha nincs auth érintés — a notice akkor nem fut.

---

## 8. Promote checklist (staging → éles)

- [ ] Stagingen a változás kézzel ellenőrizve (admin belépés a **staging** kulccsal)
- [ ] Nincs staging `DATABASE_URL` / titok a PR-ben vagy a prod Variables-ben
- [ ] PR `staging` → `main`, review, merge
- [ ] `master` megkapja ugyanazt a commitot (Railway Source)
- [ ] `gulumen-webshop` deploy log: `[start]` a www-n, health OK
- [ ] Éles admin: a **production** `ADMIN_API_KEY` (a staging kulcs ott nem jó)

---

## 9. Domain (opcionális)

- Railway staging domain, vagy DNS: `staging.gulumen.com` CNAME a Railway által adott hosztra.
- Cloudflare: a `www` DNS **ne** mutasson a staging service-re. Stagingre külön, szigorúbb WAF / IP-lista is tehető.

---

## 10. Gyors diagnosztika

| Tünet | Ok |
|-------|-----|
| Stagingre a www admin kulcsa megy | Külön `ADMIN_API_KEY` kell a staging Variables-ben |
| Stagingen éles rendelések látszanak | A `DATABASE_URL` a prod Postgresre mutat — cseréld reference-re |
| `www.gulumen.com` a `staging` ág commitját mutatja | A **gulumen-webshop** Source branch-e el lett térítve — állítsd vissza `master`-re |
| GitHub Environment reviewerre vár, de a staging URL már friss | Railway Source auto-deploy; a reviewer csak a CLI job |
| `Couldn't find service gulumen-webshop-staging` | A service neve a Dashboardon más; nevezd át, vagy a CLI `--service` egyezzen |

Kapcsolódó: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md) · [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md) · [ADMIN-BIZTONSAGI-SZABALYZAT.md](ADMIN-BIZTONSAGI-SZABALYZAT.md)
