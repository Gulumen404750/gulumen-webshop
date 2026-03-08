# Railway 502 Bad Gateway – ok és javítások

## Mi okozta a 502-et (valószínű okok)

1. **PORT** – A Railway a saját `PORT` környezeti változóján várja a trafikot. A `next start` alapból a 3000-as porton indul; ha a folyamat nem ezen a porton hallgat (mert a Railway más PORT-ot ad), a proxy 502-et ad.
2. **Prisma client** – A build során nem futott `prisma generate`, ezért a szerver indulásakor vagy az első kérésnél a `@prisma/client` import hibát dobhatott, és a folyamat leállt → 502.
3. **Hiányzó env** – Ha a Railway-on nincs beállítva pl. `DATABASE_URL` (és valahol kötelezőnek van kezelve), vagy más kritikus env hiányzik, az alkalmazás elindulásakor vagy első kérésnél elhasalhat.

---

## Elvégzett javítások

### 1. package.json – build és start

**Fájl:** `package.json`

**Változások:**

- **build:** `next build` → `prisma generate && next build`  
  Így a build fázisban legenerálódik a Prisma client, és a Next.js szerver kód (API routes, server components) mindig megtalálja.

- **start:** `next start` → `node scripts/start.js`  
  A start parancs most egy kis Node scriptet futtat, ami a **Railway által adott `PORT`** környezeti változót használja (vagy lokálisan 3000-et), és ezen a porton indítja a `next start`-ot. Így a Railway mindig a megfelelő porton kapja a válaszokat.

### 2. Új fájl: scripts/start.js

**Fájl:** `scripts/start.js` (új)

**Tartalom:**

```js
/**
 * Production start: Next.js a Railway által adott PORT-on (vagy 3000 lokálisan).
 */
const { spawnSync } = require('child_process')
const port = process.env.PORT || '3000'
const result = spawnSync('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
```

Ez biztosítja, hogy:
- Railway-en a `PORT` env alapján induljon a Next.js,
- lokálisan (`npm run start`) 3000-es porton fusson.

---

## Ellenőrzőlista Railway-on

| # | Ellenőrizendő | Megjegyzés |
|---|----------------|------------|
| 1 | **Variables** | Legyen beállítva: `DATABASE_URL` (Postgres), `NEXT_PUBLIC_APP_URL` (pl. `https://www.gulumen.com`), Stripe, OpenAI stb. – a projekt `.env.example` / `docs/ENV.md` alapján. |
| 2 | **Port** | A Networking fülön a Port **3000** maradhat; a **process** most a Railway által adott `PORT` env-en hallgat (a start script ezt használja). A Railway magától beállítja a `PORT`-ot. |
| 3 | **Build parancs** | `npm run build` (railway.json / Nixpacks: ez már így van) – így lefut a `prisma generate && next build`. |
| 4 | **Start parancs** | `npm run start` (railway.json / Nixpacks: ez már így van) – ez futtatja a `scripts/start.js`-t, ami a `PORT`-on indítja a Next.js-t. |
| 5 | **Migráció** | Ha van Postgres (DATABASE_URL), a deploy után egyszer futtasd (Railway CLI vagy egy one-off job): `npx prisma migrate deploy`. |

---

## Lokális teszt production módban

```bash
npm run build
npm run start
```

Ezután böngészőben: http://localhost:3000. Ha ez működik, a Railway 502 javításának is meg kell jelennie a deploy után.

---

## Ha még mindig 502

1. **Railway Deployments** → legutóbbi deploy → **View logs**. Keress: „Error”, „Cannot find module”, „EADDRINUSE”, „Prisma”, „listen”.
2. **Railway Variables** – minden kötelező env (pl. `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`) be van-e állítva.
3. **Health check** (opcionális): Csinálhatsz egy egyszerű `GET /api/health` végpontot, ami 200-at ad; a Railway health check erre mutathat.

---

## Rövid összefoglaló

- **Hiba oka:** A szerver nem a Railway által kiosztott PORT-on hallgatott, és/vagy a Prisma client nem készült el a build során, ezért a process nem indult el vagy azonnal elhasalt.
- **Javítás:** `package.json` build/start módosítás + `scripts/start.js`, hogy a `PORT` env alapján induljon a Next.js production szerver.
- **Következő lépés:** Commit + push, Railway újradeploy, majd logok ellenőrzése, ha még mindig 502 lenne.
