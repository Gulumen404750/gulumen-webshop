# 3D GLB checklist – válaszok a kódból és projekt állapotából

Ez a dokumentum a „Növény kötöző” (és általában a 3D termék) GLB betöltésére vonatkozó checklistre ad konkrét válaszokat a **jelenlegi kód és mappa állapot** alapján.

---

## A) Fájl és útvonal (1–20)

| # | Kérdés | Válasz |
|---|--------|--------|
| 1 | **Pontosan milyen .glb fájlnevet vár a kód?** | **`noveny-kotozo.glb`** (növény kötöző terméknél). A kód **nem** slugból generálja: a `modelUrl` a termékadatokból jön (`src/lib/data.ts` → `get3DMockProducts()` → `modelUrl: '/models/noveny-kotozo.glb'`). |
| 2 | **A .glb tényleg létezik a projektben?** | **Nem.** A `public/models/` mappában jelenleg **csak** `README.md` van; **egyetlen .glb fájl nincs** a repóban. |
| 3 | **Pontosan ide tetted? YOUR_PROJECT/public/models/** | A kód ehhez az útvonalhoz igazodik: a termék `modelUrl` értéke `/models/noveny-kotozo.glb`, ami Next.js-nél a **`public/models/noveny-kotozo.glb`** fájlt jelenti. A fájlt ide kell tenni. |
| 4 | **Fájlnévben ékezet, szóköz, nagybetű?** | A kód **kötőjelest, kisbetűs, ékezet nélküli** nevet vár: `noveny-kotozo.glb`. Nincs szóköz, nincs ékezet. |
| 5 | **A kódban használt név és a fájlnév betűre egyezik?** | A kódban: `'/models/noveny-kotozo.glb'`. A fájlnak pontosan **`noveny-kotozo.glb`** kell legyen (kisbetű, kötőjel). Case sensitive lehet a szerveren. |
| 6 | **A fájl kiterjesztése tényleg .glb?** | Igen, a kód és a konverziós pipeline is `.glb`-t vár. `.GLB` vagy dupla `.glb.glb` hibát okozhat. |
| 7 | **A fájl nem .gltf + külön bin/texture?** | A kód és a `ProductModelViewer` **csak egyetlen GLB URL-t** vár (`src`). Külön .gltf + bin/texture más upload/logika kellene. |
| 8 | **A termék slugja alapján generálja a modell nevét a kód?** | **Nem.** A modell neve **nem** generálódik a slugból. A `modelUrl` a termék objektumban van megadva (`data.ts`). A slug `noveny-kotozo`, de a fájlnév ebből nem képződik automatikusan. |
| 9 | **Slugból képzett fájlnév egyezik a valós fájllal?** | Nincs ilyen logika: a fájlnév a `modelUrl`-ból jön, ami manuálisan van beállítva. A `scripts/3d-webshop-paths.json`-ben az `output` mező **`noveny-kotozo.glb`** – ezt a konverziós script írja `public/models/` alá. |
| 10 | **A modell útvonal src="/models/xxx.glb" vagy src="models/xxx.glb"?** | A kód **`/models/noveny-kotozo.glb`** (kezdő perjel) formátumot használ. A viewer ezt úgy használja: `modelUrl = origin + src`, tehát pl. `http://localhost:3000/models/noveny-kotozo.glb`. |
| 11 | **Böngészőben direkt megnyitva: http://localhost:3000/models/VALAMI.glb** | Ha a fájl **nincs** a `public/models/` alatt → **404**. Ha **van** `public/models/noveny-kotozo.glb` → letöltődik / megjelenik (attól függően, hogy a szerver milyen Content-Type-pal szolgálja). |
| 12 | **Ha 404: a public/models mappát a Next.js szolgálja?** | Igen. A Next.js a `public/` mappát a gyökérből szolgálja, tehát `public/models/x.glb` → `/models/x.glb`. |
| 13 | **Van véletlenül public/model (singular)?** | Nem. A kód és a konverziós script is **`public/models`** (többes szám) mappát használ. |
| 14 | **Másik projekt mappa / másik localhost?** | Ellenőrizd, hogy a futó dev szerver pont ebből a repo mappából (`Veboldal`) indul. |
| 15 | **Next appban assetPrefix / basePath?** | **Nincs.** A `next.config.js`-ben nincs `assetPrefix` vagy `basePath`; a static fájlok a gyökérből érkeznek. |
| 16 | **next.config.js-ben valami a static fájlokat érinti?** | Nem. Csak `images` és Sentry van; a static fájlokra nincs speciális config. |
| 17 | **Deploy: a build során felkerül a public/models?** | Igen, a `public/` tartalma bemásolódik a buildbe. Ha a repóban nincs .glb, deploynál sem lesz – a fájlokat hozzá kell adni (vagy konverzióval legenerálni) és commitolni, vagy CDN/S3-ről kell szolgálni. |
| 18 | **Gitignore dobja ki a .glb-kat?** | **Nem.** A `.gitignore` nem tartalmaz `*.glb` vagy `public/models` kizárást; a .glb fájlok commitolhatók. |
| 19 | **Windows: rejtett .glb a végén (szóköz)?** | Ha a fájl neve pl. `noveny-kotozo.glb ` (szóköz a végén), a kérés `/models/noveny-kotozo.glb` (space nélkül) 404 lesz. Érdemes átnevezni úgy, hogy ne legyen trailing space. |
| 20 | **Extrém méret (pl. 200MB) időtúllépés?** | A `ProductModelViewer` 18 másodperc után hibát jelez, és 6 másodperc után „Nagy modell, még tölt…” üzenetet. Nagyon nagy fájl esetén a betöltés vagy a HEAD kérés is időtúllépésre futhat. |

---

## B) HTTP / Console / Network hibák (21–35)

| # | Kérdés | Válasz |
|---|--------|--------|
| 21–22 | **Console / Network: mit ír, mi a .glb státusz?** | Ha a fájl hiányzik: a komponens **HEAD** kérést intéz a `modelUrl`-ra; 404 esetén `setModelError(true)` → „A 3D modell nem tölthető” + a hibaüzenet a `public/models` és a `npm run convert-3d:webshop` parancsra hivatkozik. Network fülön a .glb kérés **404**. |
| 23 | **A .glb request URL pontosan mi?** | `window.location.origin + src`, pl. `http://localhost:3000/models/noveny-kotozo.glb`. A `src` a termék `modelUrl`-ja: `/models/noveny-kotozo.glb`. |
| 24–25 | **CORS / MIME / CORB** | Lokálisan same-origin, CORS általában nem gond. Ha külső domainről töltöd a modellt, CORS és MIME beállítások kellenek. |
| 26 | **Content-Type a .glb-re?** | Next.js / Vercel általában `application/octet-stream` vagy megfelelő binary típust ad. Ideál: `model/gltf-binary`. |
| 27–30 | **200 de mégsem jó / HTML hibapage / Range / cache** | Ha 200, de a response mérete 0 vagy HTML: valószínűleg valami rewrite/fallback ad vissza oldalt. Hard reload (Ctrl+Shift+R), incognito, más böngésző kizárja a cache-t. |
| 31–32 | **model-viewer script betöltődik?** | A layout `model-viewer.min.js` (4.1.0) preload linket ad; a `ProductModelViewer` ugyanazt a scriptet dinamikusan is betölti, ha még nincs. Ha a script 404: CDN/network probléma. |
| 33 | **„model-viewer is not defined”** | A komponens a script load után hozza létre a `<model-viewer>` elemet, szóval normálisan nincs ilyen. Ha mégis: a script nem töltődött be, vagy a custom element regisztráció késik. |

---

## C) Model-viewer / Three.js integráció (36–55)

| # | Kérdés | Válasz |
|---|--------|--------|
| 36 | **model-viewer vagy three.js?** | **model-viewer** (Google). Nincs közvetlen Three.js/GLTFLoader a termékoldal viewerében. |
| 37–38 | **`<model-viewer>` a DOM-ban, src kitöltve?** | A komponens `document.createElement('model-viewer')` + `el.setAttribute('src', src)`. A `src` a prop, azaz a termék `modelUrl` (pl. `/models/noveny-kotozo.glb`). Inspect-ban látszik kell a tag és a src. |
| 39–40 | **Csak client, nincs SSR error?** | Igen: `ProductModelViewer` csak kliensen töltődik: `dynamic(..., { ssr: false })`. Így kerüli a Node/V8 hibát Windows alatt. |
| 41 | **Konténer magasság?** | Van: `min-height: 280px` (wrapper és a model-viewer style), és `aspect-square` a termékoldalon. |
| 42–43 | **display:none / opacity:0 / overlay?** | A kódban nincs ilyen, ami eltakarja a viewert. |
| 44–45 | **auto-rotate, kamera, shadow** | `auto-rotate`, `camera-controls`, `shadow-intensity="1"`. Ha minden fekete: lighting/environment (pl. `environment-image`) lehet próbálható. |
| 46–50 | **Poster, normálok, skála, environment-image** | Jelenleg nincs poster, scale vagy environment-image a kódban. Ha a modell túl kicsi/nagy vagy sötét: ezeket érdemes kipróbálni. |
| 51–52 | **WebGL error** | Ha „WebGL context lost” vagy „not supported”: böngésző/GPU korlát. |

---

## D) A GLB fájl épsége (56–70)

| # | Kérdés | Válasz |
|---|--------|--------|
| 56–59 | **glTF viewerben betölt? Konvertálás hibás?** | A konverzió: STL → GLB (`@polar3d/model-converter`), majd `gltf-transform optimize`. A forrás STL útvonalak a `scripts/3d-webshop-paths.json`-ben vannak. Ha a glTF viewerben sem tölt: konverzió vagy forrás STL a gyanús. |
| 60–61 | **Túl nagy poly / file?** | Nagy poly vagy 20–200 MB esetén lassú betöltés vagy timeout. Optimalizálás: `gltf-transform optimize` (ezt a script már futtatja). |
| 62–65 | **Draco, textura, origin, bounding box, normálok** | model-viewer támogatja a Draco-t. GLB-nél a textúra beágyazott. Origin/bounding box/normálok esetén a modell „üres” vagy furán néz ki – ilyenkor a modell vagy a skála/ environment beállítás segíthet. |
| 66–67 | **Egyszerű teszt GLB vs. a te GLB-d** | Ha egy egyszerű kocka GLB működik, a gond a konkrét fájllal vagy a konverzióval van. |

---

## E) Termékadat / mapping bug (71–85)

| # | Kérdés | Válasz |
|---|--------|--------|
| 71–72 | **modelUrl mező, honnan kapja?** | A terméknek van `modelUrl` mezője (`src/lib/data.ts` Product típus). A komponens a **termék objektumból** kapja: `product.modelUrl`. Nincs DB: jelenleg mock adat. |
| 73–74 | **Fallback: slugból generál?** | **Nincs** fallback. Ha nincs `modelUrl`, a 3D viewer nem jelenik meg (`has3DModel = is3DProduct(product) && product.modelUrl`). |
| 75 | **Slug: noveny-kotozo vagy noveny_kotozo?** | **noveny-kotozo** (kötőjel). A termék slugja és a `modelUrl` fájlnév is kötőjelest használ. |
| 76 | **„3d és webshop közt kettőspont”** | A hibaüzenetben a **parancs** szerepel: `convert-3d:webshop` (kettőspont az npm script nevében). A fájlnevekben nincs kettőspont. |
| 77–80 | **scripts/3d-webshop-paths.json** | **Van.** Tartalma: két bejegyzés, input = teljes STL útvonal (Windows path), output = `noveny-kotozo.glb` ill. `szalveta-tarto-korok.glb`. A script ezzel a mappinggel konvertál és a kimeneti fájlneveket a `public/models/` alá írja. |
| 81–85 | **Mapping buildben, admin, nyelvek, cache, slug feldolgozás** | Jelenleg nincs admin feltöltés; a modelUrl fix a mock adatban. Több nyelvnél ugyanaz a termék objektum, ugyanaz az URL. A slug a Next route param; a termék a `getProductBySlug(slug)`-ból jön, a `modelUrl` a termékben van – nincs külön slug→modelUrl átalakítás. |

---

## F) Környezet / deployment (86–100)

| # | Kérdés | Válasz |
|---|--------|--------|
| 86–87 | **Localhost vs deploy** | Ha a repóban nincs .glb, mindkettőn 404. Ha lokálisan kézzel beteszed a fájlt, de nem commitolod, deploynál továbbra is 404. |
| 88–89 | **Vercel 50MB limit, CDN** | Nagy .glb (pl. 50MB+) esetén Vercel static limit vagy CDN tiltás lehet. Kisebb, optimalizált GLB (optimize után) általában oké. |
| 90–92 | **basePath, public content, models excluded** | Nincs basePath. A `public/` tartalma bemásolódik; a `models` mappa nincs kizárva. |
| 93 | **Docker: public/models benne van?** | Ha a build context és a COPY tartalmazza a `public` mappát a .glb fájlokkal, igen. |
| 94–95 | **Nginx: MIME, static** | Ha Nginx szolgálja a staticot, a .glb-nek megfelelő MIME (pl. `model/gltf-binary` vagy `application/octet-stream`) kell. |
| 96–100 | **S3 / CDN** | Ha a modell S3-ről vagy CDN-ről jön: CORS, Content-Type és a fájl láthatósága (public/private) számít. A jelenlegi kód lokális `/models/...` URL-t vár; külső URL is működik (a viewer `src.startsWith('http')` esetén abszolút URL-t használ). |

---

## Összefoglaló – mi a legvalószínűbb ok, ha nem jelenik meg a 3D modell?

1. **A .glb fájl nincs a projektben.** A `public/models/` mappában jelenleg **csak README.md** van; **nincs `noveny-kotozo.glb`** (és nincs `szalveta-tarto-korok.glb` sem).
2. **Teendő:** Futtasd a konverziót a megfelelő forrás STL-ekkel, és a kimeneti fájlokat tedd a `public/models/` mappába a helyes névvel:
   - **Növény kötöző:** `public/models/noveny-kotozo.glb`
   - **Szalvéta tartó:** `public/models/szalveta-tarto-korok.glb`

   Konverzió (a `3d-webshop-paths.json`-ben lévő input útvonalaknak létezniük kell):
   ```bash
   npm run convert-3d:webshop
   ```
   Ha a JSON-beli `input` útvonalak (pl. a másik asztalon lévő STL mappa) nem elérhetők, másold át a szükséges STL fájlokat egy elérhető mappába, és frissítsd a `scripts/3d-webshop-paths.json`-t, majd futtasd újra a parancsot.

3. **Ellenőrzés:** Ha a fájl megvan, böngészőben nyisd meg: `http://localhost:3000/models/noveny-kotozo.glb`. Ha letöltődik (vagy a model-viewer megjelenik), az útvonal és a fájlnév rendben van.

---

*Dokumentum a kódbázis és a projekt állapota alapján készült (public/models tartalma, data.ts, ProductModelViewer, convert-3d.mjs, next.config.js, .gitignore).*
