# Railway deploy – www.gulumen.com

## A hiba oka

A `Couldn't find any 'pages' or 'app' directory` azt jelenti, hogy a **build nem a projekt gyökeréből fut**, vagy a **feltöltött/klónozott kódban nincs `src/app` mappa**.

## Mit kell ellenőrizni / beállítani

### 1. Root Directory (a legfontosabb)

- Railway projekt → **gulumen-webshop** → **Settings** (vagy **Variables** mellett).
- Keresd: **Root Directory** / **Deploy** szekció.
- **Állítsd üresre** (vagy `.`), ne legyen megadva almappa (pl. `frontend`, `web`).
- Ha almappa van beállítva, onnan keresi a Next.js az `app`/`pages` mappát, és nem találja a `src/app`-et.

### 2. GitHub-ról deployolj (ne “Add files via upload”-tal)

- **Connect Repository**: a projektedet kösd a GitHub repo-hoz.
- Így a **teljes repo** (beleértve a `src/` mappát) felkerül, és a build megtalálja a `src/app`-et.
- Ha “Add files via upload”-tal töltöttél fel, gyakran csak a gyökér fájlok kerültek fel, **a `src` mappa nélkül** – ez pont ezt a hibát adja.

### 3. Build / Start parancsok

A projektben **railway.json** és **nixpacks.toml** is szerepel:

- **railway.json**: Railway dashboard felülírása nélkül explicit `npm run build` és `npm run start`.
- **nixpacks.toml**: Nixpacks használata esetén ugyanezek a parancsok a projekt gyökeréből.

A build lokálisan is lefut (`npm install` → `npm run build` → `npm run start`). Railway Settings-ben a **Root Directory** legyen üres (vagy `.`).

### 4. Környezeti változók

- Add hozzá a Railway **Variables**-ben az összes szükséges env változót (pl. adatbázis URL, Stripe, stb.), amit lokálisan `.env`-ben használsz.
- A `.env` fájl **nem** kerül fel a repoba (gitignore), ezért a Railway-n minden értéket külön be kell állítani.

### 5. Domén: www.gulumen.com

- Railway projekt → **Settings** → **Domains** / **Networking**.
- Add hozzá a **www.gulumen.com** domént (és ha kell, a **gulumen.com**-ot is).
- A DNS-nél (ahol a domént kezeled) állítsd a CNAME rekordot a Railway által megadott célra (pl. `xxx.railway.app`).

---

## FONTOS: két service – csak a gulumen-webshop-ot használd!

A Railway projektben **két** webshop service lehet:

| Service | Domain | Mit csinálj |
|---------|--------|-------------|
| **gulumen-webshop** | `www.gulumen.com` | **Ide deployolj!** GitHub → master |
| **dynamic-perfection** | nincs (Unexposed) | **Ne használd** – törölheted |

Ha a GitHub push a **dynamic-perfection**-re megy, a weboldal **nem változik**, mert a domain a **gulumen-webshop**-on van.

### Deploy a helyes service-re

1. Railway → **gulumen-webshop** (NE dynamic-perfection)
2. **Settings** → **Source** → GitHub repo: `Gulumen404750/gulumen-webshop`, branch: **master**
3. **Deployments** → **Deploy** / legújabb commit (pl. *bootstrap v3*, *gulumen-webshop service*)
4. Deploy Logs eleje: `[start] gulumen-webshop bootstrap v3`

### Variables (gulumen-webshop)

- `DATABASE_URL` → **Reference** → Postgres → `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL` → `https://www.gulumen.com`

### Automatikus deploy (opcionális)

GitHub → repo → Settings → Secrets → `RAILWAY_TOKEN` (Railway → gulumen-webshop → Settings → Tokens).  
Push után a GitHub Actions a **gulumen-webshop**-ot deployolja (`railway up --service gulumen-webshop`).

---

**Röviden:**  
Állítsd a **Root Directory**-t üresre, és **GitHub-ról** deployolj a **gulumen-webshop** service-re (ne dynamic-perfection), hogy a `src/app` mappa mindig benne legyen a buildben.
