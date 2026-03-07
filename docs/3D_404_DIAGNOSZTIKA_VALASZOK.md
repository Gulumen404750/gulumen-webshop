# 3D GLB 404 – diagnosztika és válaszok

## Mit csináltam most

- **public/test.txt** létrehozva (tartalom: `hello`) → teszteld: `http://localhost:3000/test.txt`
- **next.config.js**: nincs `rewrites`, nincs `basePath`, nincs `assetPrefix`
- **Route-ok**: nincs `app/.../route.ts` ami `/models/*`-ra ülne (csak `/api/*` route-ok)
- **modelUrl** a kódban: pontosan **`/models/noveny-kotozo.glb`** (nem `/api/models/...`)
- **public mappa**: a projektben a mappa neve **models** (nem `model`)

---

## A) Kiszolgálás (404 vs 200)

- A **middleware matcher** kihagyja a **`/models/`** útvonalat.
- A fájl a repóban: **`public/models/noveny-kotozo.glb`** (1812 bájt).
- A Next appnak a **package.json mappájából** kell futnia: `npm run dev` a projekt gyökerében.

**Neked ellenőrizendő:**

1. **http://localhost:3000/models/noveny-kotozo.glb** → 200 vagy 404?
2. **http://localhost:3000/test.txt** → 200 vagy 404? (ha 200, a public static működik.)
3. Network fül: a `.glb` kérés **status**, **response size** (~1.8 KB), **content-type** (valami `model/gltf-binary` vagy `application/octet-stream`).

---

## B) GLB épsége (1812 bájt)

- A jelenlegi GLB a **minimal placeholder STL**-ből készült (**1 háromszög**), ezért ~1,8 KB. Nem sérült, de szinte láthatatlan.
- **scripts/3d-webshop-paths.json** a **3d-source/noveny-kotozo.stl**-re mutat (relatív path).
- Ha a saját, nagy STL-edet másolod a **3d-source/** mappába és futtatod a **npm run convert-3d:webshop**-ot, a GLB mérete MB-os nagyságrendű lehet.

**donmccurdy glTF Viewer (gltf-viewer):**

- A jelenlegi **noveny-kotozo.glb** betölt → **van geometria** (1 mesh, 1 primitive, 1 háromszög), de nagyon kicsi, szinte pontszerű.
- Ha valódi STL-ből konvertálsz, a viewerben normál méretű modellt kell látnod.

**Optimize kikapcsolása (egy futásra):**  
A `scripts/convert-3d.mjs`-ben az `optimizeGlb` hívást át lehet ideiglenesen kommentelni; akkor a konvertált (optimalizálatlan) GLB mérete nagyobb lesz. A 1812 bájtos méret az **optimalizált**, 1-triangle modellnek megfelelő.

---

## C) Next „pro” kérdések

- **Rewrite:** nincs (next.config.js-ben nincs `rewrites`).
- **Route ráül /models/*-ra?** Nincs; nincs catch-all vagy `app/.../route.ts` a `/models` útvonalra.
- **„Próbált URL” a felületen:** a kód `window.location.origin + src`-t ír, ahol `src = '/models/noveny-kotozo.glb'` → pl. **http://localhost:3000/models/noveny-kotozo.glb** (nem `/api/models/...`).
- **public mappa neve:** **models** (a kódban is `public/models`).
- **Teszt statik:** **public/test.txt** létrehozva; **http://localhost:3000/test.txt** → 200 esetén a static serving rendben van.

---

## Mit kell most megválaszolnod (3 pont)

1. **http://localhost:3000/models/noveny-kotozo.glb** → **200** vagy **404**?
2. **http://localhost:3000/test.txt** → **200** vagy **404**?
3. A **GLB betöltötted a gltf-viewerbe?** → **Van geometria** (1 kis háromszög / mesh), vagy **üres** (semmi nem jelenik meg)?

Ha (1) 404 és (2) 200 → a public működik, de a `/models/` útvonal valami miatt nem (pl. futási mappa, cache).  
Ha (1) 200 és (3) van geometria → a fájl és a GLB rendben van; ha a termékoldal még mindig hibás, akkor a viewer/script betöltés vagy a GET ellenőrzés a gyanús.
