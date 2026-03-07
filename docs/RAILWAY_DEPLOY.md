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

**Röviden:**  
Állítsd a **Root Directory**-t üresre, és **GitHub-ról** deployolj (ne feltöltéssel), hogy a `src/app` mappa mindig benne legyen a buildben. Ez feloldja a `Couldn't find any 'pages' or 'app' directory` hibát.
