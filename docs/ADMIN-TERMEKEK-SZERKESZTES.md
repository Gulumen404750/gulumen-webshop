# Admin: termékek szerkesztése (képek, árak, új termék)

Ha az admin felületen **nem tudod módosítani a képeket, árakat**, vagy **felrakni új termékeket**, általában két dolog egyike hiányzik.

---

## 1. Be vagy jelentkezve?

A terméklista és a szerkesztés csak **bejelentkezett adminnak** működik (cookie: `admin_authorized`).

- Menj a **Admin belépés** oldalra: **`/admin/login`** (vagy a főoldalról: Gulumen → belépés).
- Add meg az **API kulcsot** (a Railway Variables-ban beállított **ADMIN_API_KEY** értéke).
- Kattints **Belépés**.
- Ezután a **Termékek** menüpont listázni és szerkeszteni tud.

Ha nem vagy bejelentkezve, a kérés **401 Unauthorized**-ot ad, és az oldal most már ezt írja: *„Nincs jogosultság. Jelentkezz be: Admin belépés (API kulcs).”*

---

## 2. Van beállítva a DATABASE_URL?

A termékek az **adatbázisban** (Postgres) vannak. Ha a Railway-en **nincs** **DATABASE_URL** változó (vagy üres), az admin termék API **503**-at ad: *„Adatbázis nincs beállítva.”*

- Railway → **Variables** → add hozzá: **DATABASE_URL** = Postgres connection string (pl. Railway Postgres szolgáltatásból).
- Migráció (ha még nem futott): `npx prisma migrate deploy`.
- Ezután az admin **Termékek** lista és az **Új termék** / **Szerkesztés** működni fog.

---

## Mit tud az admin termékfelület?

- **Termékek** lista: keresés, típus szűrő, **Új termék** gomb.
- **Szerkesztés** (vagy új termék): slug, név (HU/EN/DE/RO), leírás, **ár (Ft)**, akciós ár, **kép URL**, többi kép, 3D model URL, készlet, aktív/újdonság/akciós, beszerzéses deal (lejárat, max rendelések).

A **képek** jelenleg **URL-ként** adhatók meg (fő kép: **Kép URL**, többi: tömb). Fájlfeltöltés (upload) nincs az alkalmazásban; a képeket máshol tartsd (CDN, Storage), és az URL-t illeszd be az adminban.

---

## Összefoglaló

| Probléma | Megoldás |
|----------|----------|
| Nem listázódnak a termékek / „Nincs jogosultság” | Jelentkezz be: **/admin/login** → API kulcs (ADMIN_API_KEY). |
| „Adatbázis nincs beállítva” | Railway **Variables** → **DATABASE_URL** = Postgres connection string. |
| Képet nem tudok feltölteni | Képfeltöltés nincs; használj külső tárolót és add meg a **Kép URL**-t. |
