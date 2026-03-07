# Lejárt vásárlás effekt – drámai többfázisú animáció

## Mikor játszik le

- Amikor a **Beszerzésre rendelhető** listán egy ajánlat **lejár** (visszaszámláló 0-ra ér, vagy a szerver szerint már closed/soldout).
- A `SourcingDealCardCountdown` meghívja az `onExpired(productId)` callbacket → a `BeszerzesreRendelhetoClient` a termék id-t beteszi az `expiredAnimatingIds` set-be → a megfelelő `ProductCard` megkapja a `showSoldImpact={true}` propot.

## Animáció fázisai (összesen ~6,9 s kártya eltűnésig, utána refresh 8 s-nál)

### 1. Lejárat pillanata – kártya elsötétedik, blur, **először a logó jelenik meg a képen**

- A **teljes termékkártya** kissé **elsötétedik** (sötét overlay).
- A **háttér finoman blur**-ös lesz (`backdrop-filter: blur(6px)`).
- **A kártya közepén, a képen először a Gulumen logó jelenik meg** (kerek logo, `/img/logo-round.png`) – drámai megjelenés + rövid fényvillanás. A logó itt még **nem forog**.

### 2. Logó – intenzív pulzálás (még nem forog)

- **Pulzálás:** méretváltozás (scale 1↔1.08), **fényglow** (box-shadow fehér + kék), **lüktető árnyék**.
- Két ciklus, 1,2 s × 2 (0,7 s–3,1 s). **Itt még nem kezd el forogni a logó** – csak megjelenik és pulzál.

### 3. Logó – **gyors, dinamikus forgás**

- A logó **gyorsan forog** (0°→1080°), 1,05 s, sok keyframe = sima interpoláció, gyorsuló ütem.
- Easing: `cubic-bezier(0.22, 0.61, 0.36, 1)`. Közben csak transform animálódik (box-shadow csak 0% és 100%-nál), így kevesebb szaggatás. `will-change: transform` a jobb teljesítményért.

### 4. Logó – zsugorodás, energia-robbanás

- A logó **összezsugorodik**, **koncentrált fénygyűrű**, majd **energia-robbanás** (fényrészecskék + villanás).

### 5. Kártya – nem forog a tengelye körül

- **Remegés:** a kártya enyhén **megremeg**.
- A kártya **nem pörög** a saját tengelye körül – csak **enyhe távolodás** (translateZ), **zsugorodás** (scale 0), **utolsó villanás** és **fade-out**. Enyhe perspektív döntés (rotateY/X csak pár fok) a térhatásért.

## Időzítés

- **SOLD_ANIMATION_DURATION_MS = 8000** (BeszerzesreRendelhetoClient).
- Logó: flash 0,7 s → pulse 0,7–3,1 s → spin 3,1–4,15 s (1,05 s) → explode 4,2–4,8 s. Részecskék: 4,2 s. Kártya remegés: 4,85 s; kártya eltűnés: 5,3–6,9 s.
- 8 s után: a termék kikerül a listából, és meghívódik a `router.refresh()`.

## Animáció befejezése után

- A termék **„Lejárt” státuszba** kerül, **kikerül az aktív ajánlatok** közül, és **átkerül a „Lejárt termékek” oldalra**.
- A Lejárt termékek listán **5 napig** megjelenik (az elmúlt 5 napban lejárt ajánlatok). **5 nap elteltével** kikerül a listából (a rendszer nem listázza tovább – a 5 napos ablakon kívülre kerül).

## Komponensek és CSS

- **SoldImpactOverlay:** `sold-impact-backdrop` (sötétítés + blur), `sold-impact-label` („Lejárt”), `sold-impact-logo-wrap` (logó fázisok), `sold-impact-particle` (8 db fényrészecske).
- **ProductCard:** `sold-impact-card-wrapper` (perspective 1200px, a Link-en), `sold-impact-card-vanish` (remegés + 3D vanish az article-en).
- **globals.css:** `sold-impact-*`, `sold-logo-*`, `sold-card-*`, `sold-particle-*` keyframe-ok.

## Összefoglalva

- **Trigger:** countdown lejár → `onExpired(id)` → `showSoldImpact` true.
- **Vizuál:** sötétítés + blur → **logó először megjelenik a képen** (villanás) → logó pulzál (még nem forog) → **itt a logó kezd el forogni** → robbanás + részecskék → kártya remegés → kártya zsugorodik + fade (nem forog a tengelye körül).
- **Utána:** ~8 s múlva a kártya kikerül a listából, a termék a Lejárt termékek oldalon jelenik meg; 5 nap után kikerül a Lejárt listából is.

**Folyamatok áttekintés:** [FOLYAMATOK.md](./FOLYAMATOK.md)
