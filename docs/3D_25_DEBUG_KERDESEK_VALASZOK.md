# 3D GLB – 25 célzott debug kérdés (válaszok)

## A) Biztosan 200-e a statikus fájl?

| Kérdés | Válasz (te ellenőrizd / kód alapján) |
|--------|--------------------------------------|
| **A http://localhost:3000/test.txt 200?** | Igen/Nem – **te teszteld** (a fájl létezik: `public/test.txt`) |
| **A http://localhost:3000/models/noveny-kotozo.glb 200?** | Igen/Nem – **te teszteld** |
| **Ha a .glb 200: a Response Headers-ben mi a content-type?** | Pl. `model/gltf-binary` vagy `application/octet-stream` – **Network → Headers** |
| **A .glb response body mérete tényleg ~1812 B?** | Igen – a fájl 1812 bájt (a repóban). **Network → Size** ellenőrizhető. |
| **A .glb kérést GET-tel is 200-ra kapod?** | A viewer **GET**-tel kéri (fetch + model-viewer is GET). Direkt böngészőben a címsor is GET. |

---

## B) A termékoldal pontosan mit kér le?

| Kérdés | Válasz |
|--------|--------|
| **A termékoldalon a Network fülön pontosan milyen URL-t kér a viewer?** | **Te nézd meg** (Copy link address). A kód szerint: **abszolút URL** = `window.location.origin + '/' + src` → pl. `http://localhost:3000/models/noveny-kotozo.glb`. |
| **A termékoldal által próbált URL egyezik-e a direkt teszt URL-lel?** | Igen – ugyanaz az URL (origin + `/models/noveny-kotozo.glb`). |
| **A "Próbált URL" linkre kattintva új tabon 200 vagy 404?** | **Te teszteld** – a link pontosan ezt az abszolút URL-t nyitja. |
| **Van-e véletlen dupla origin?** | **Nem.** A kód: `origin + (src.startsWith('/') ? '' : '/') + src` → egy origin, nincs duplázás. |
| **Van-e véletlen whitespace a src attribútumban?** | **Nincs.** A `src` most **trim()**-mel van kezelve (`srcTrimmed`). |

---

## C) A GET "létezés ellenőrzés" logika

| Kérdés | Válasz |
|--------|--------|
| **A GET ellenőrzés melyik URL-t fetch-eli: abszolút vagy relatív?** | **Abszolút**: `http://localhost:3000/models/noveny-kotozo.glb` (relatív `src`-ból képzett). |
| **A GET ellenőrzésnél milyen cache mód van?** | **`cache: 'no-store'`** (explicit, nincs default cache). |
| **A GET válasz res.ok true?** | **Konzolban látszik:** a kódban van `console.log('3D check status:', r.status, r.headers.get('content-type'), 'ok:', r.ok)`. |
| **A GET hibára fut? (catch)** | Ha igen, **konzolban:** `console.warn('3D check fetch error:', err?.message ?? err)` (pl. TypeError: Failed to fetch / CORS / net::ERR_...). |
| **Debug logok** | **Bekapcsolva:** `console.log('3D check url:', modelUrl)` és `console.log('3D check status:', r.status, ...)`. |

*Redirect (301/302):* a fetch követi a redirectet; a `res` a **végső** válaszra vonatkozik. Ha a végső válasz 200, `res.ok === true`.

---

## D) model-viewer script és custom element

| Kérdés | Válasz |
|--------|--------|
| **A model-viewer.min.js Networkben 200?** | Igen/Nem – **te nézd a Network fülön** (script: `https://ajax.googleapis.com/.../model-viewer.min.js`). |
| **customElements.get('model-viewer') a konzolban mit ad?** | Script betöltés + definiálás után: **function** (a custom element konstruktor). Ha még nincs betöltve: **undefined**. **Te futtasd a konzolban** a termékoldalon. |
| **A customElements.whenDefined('model-viewer') lefut-e (resolve)?** | A kód csak ezután állítja `ready`-t true-ra és rendereli a viewert – ha a script 200, általában resolve. Ha nem ér vissza: script blokkolva / hiba. |
| **Utána renderelődik-e egy &lt;model-viewer&gt; a DOM-ba?** | Igen – a második useEffect `containerRef.current.appendChild(el)` hozzáadja. **Inspect → Elements:** keress `model-viewer`. |
| **A &lt;model-viewer&gt; elem src attribútuma mi? (Inspect)** | **Abszolút URL**, pl. `http://localhost:3000/models/noveny-kotozo.glb` (nem relatív). |

---

## E) Viewer render – látszik-e valami?

| Kérdés | Válasz |
|--------|--------|
| **Ha a GLB 1 háromszög: lehet, hogy “nem töltene be”, de valójában betölt.** | A jelenlegi GLB **1 háromszög** (placeholder). Nagyon kicsi – lehet, hogy alig látszik, de a viewer UI (kamera, forgatás) működhet. |
| **Megjelenik-e a viewer UI (forgatás)?** | **Te teszteld** – ha a script és a GLB 200, általában megjelenik a doboz és a kamera kontrollok. |
| **Próbáltad-e: camera-orbit, field-of-view, exposure, environment-image?** | **Igen, be van állítva** a kódban: `camera-orbit="45deg 55deg 2m"`, `field-of-view="45deg"`, `exposure="1"`, `environment-image="neutral"` – hogy a kis modell is jobban látszon. |
| **Ha ezekkel sem látszik: &lt;model-viewer&gt; runtime error a konzolban?** | **Te nézd** a Console fülön (piros hiba). |
| **WebGL tiltás (chrome://gpu)?** | **Te nézd** – chrome://gpu lapon hogy WebGL (Hardware accelerated) enabled-e. Ritka, de ha tiltva van, a viewer nem tud renderelni. |

---

## Összefoglaló – mit csináltam a kódban

1. **Debug logok:** `console.log('3D check url:', modelUrl)` és `console.log('3D check status:', r.status, r.headers.get('content-type'), 'ok:', r.ok)`.
2. **Fetch catch:** `console.warn('3D check fetch error:', err?.message ?? err)`.
3. **src trim:** `(src || '').trim()` – nincs whitespace a URL-ban.
4. **Viewer attribútumok** (kis modell láthatósága): `camera-orbit="45deg 55deg 2m"`, `field-of-view="45deg"`, `exposure="1"`, `environment-image="neutral"`.

---

## Mit nézz a böngészőben (1 kör)

1. **Console:** induláskor megjelenik-e a **"3D check url:"** és **"3D check status:"** log (és mi a status / ok).
2. **Network:** a **noveny-kotozo.glb** és a **model-viewer.min.js** kérések **státusza** (200 / 404) és a .glb **méret**.
3. **Elements / Inspect:** van-e **&lt;model-viewer&gt;** és mi a **src** attribútum értéke.

Ezekből kiderül, hogy a hiba a kiszolgálás (404), a fetch (CORS/hálózat), vagy a model-viewer (script / WebGL) szintjén van-e.
