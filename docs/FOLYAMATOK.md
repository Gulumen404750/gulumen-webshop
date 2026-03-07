# Folyamatok – összefoglaló

A projekt fő üzleti és technikai folyamatai, rövid leírásokkal és hivatkozásokkal.

---

## 1. Sourcing: lejárt ajánlatok (Beszerzésre rendelhető ↔ Lejárt termékek)

**Rövid leírás:** Egy időzített ajánlat lejárta után kikerül az aktív listáról, lejárt animáció lejátszódik, majd a termék a „Lejárt termékek” oldalon jelenik meg. A lejárt termék soha ne kerüljön vissza az aktív listára.

**Kulcsfontosságú értékek:**
- `SOURCING_EXPIRED_BUFFER_MS = 30_000` (30 s) – ennyivel a lejárat előtt már „lejártnak” számít
- `SOLD_ANIMATION_DURATION_MS = 8000` – animáció hossza, utána `router.refresh()`
- `EXPIRED_WINDOW_MS = 5 nap` – a Lejárt termékek listán csak az elmúlt 5 napban lejártak
- sessionStorage kulcs: `gulumen_sourcing_hidden_expired` – kliensen rejtett lejárt id-k

**Folyamat lépései:**
1. Szerver: aktív lista csak nem lejárt (saleTo > serverNow + buffer, status preview/sale).
2. Szerver: SEED_NOW stabil (globalThis), így a teszt termék 5 perc után tényleg lejárt a szerveren is.
3. Kliens: számláló a `serverNow`-ból számolt „most”; ha már lejárt → azonnal „Hamarosan archiválásra kerül” + onExpired.
4. Kliens: onExpired → animáció → 8 s után productId sessionStorage + state → router.refresh().
5. Kliens: első render = szerver listája (hasMounted false, nincs hydration hiba); mount után sessionStorage alapján rejtjük a lejártat.
6. Lejárt oldal: ugyanaz az `isSourcingConsideredExpired` + 5 napos ablak.

**Részletes doc:** [SOURCING_LEJART_FOLYAMAT.md](./SOURCING_LEJART_FOLYAMAT.md)

---

## 2. Lejárt vásárlás vizuális effekt (logó + kártya animáció)

**Rövid leírás:** Amikor a countdown lejár, a kártyán sötét overlay + blur, megjelenik a Gulumen logó (villanás → pulzálás → gyors forgás → robbanás), majd a kártya remeg és 3D-ben eltűnik.

**Időzítés (aktuális):**
- Logó: flash 0.7 s → pulse 1.2 s × 2 (0.7 s–3.1 s) → spin 1.05 s (3.1 s–4.15 s) → explode 4.2 s–4.8 s
- Részecskék: 4.2 s
- Kártya remegés: 4.85 s; kártya eltűnés: 5.3 s–6.9 s
- Összesen ~8 s, utána refresh

**Részletes doc:** [SOURCING_LEJART_EFFEKT.md](./SOURCING_LEJART_EFFEKT.md)

---

## 3. Egyéb dokumentumok

| Doc | Tartalom |
|-----|----------|
| [LEJART_TERMEK_ANALIZIS.md](./LEJART_TERMEK_ANALIZIS.md) | Miért kerülhetett vissza a lejárt termék; hydration, sessionStorage, SEED_NOW |
| [SOURCING_100_ANSWERS.md](./SOURCING_100_ANSWERS.md) | Sourcing Q&A, limitált ajánlatok |
| [DB_ORDERS_COUNT_50_ANSWERS.md](./DB_ORDERS_COUNT_50_ANSWERS.md) | Rendelésszám (ordersCount) adatbázis / API |
| [ENV.md](./ENV.md) | Környezeti változók |
| [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) | Éles kör checklist |
| [BIZTONSAGI-AUDIT.md](./BIZTONSAGI-AUDIT.md) | Biztonsági audit |
| [KEDVELESSZAM-NYILVANOS.md](./KEDVELESSZAM-NYILVANOS.md) | Kedvelésszám nyilvános megjelenítés |

---

## 4. Fontos fájlok (folyamatokhoz)

- `src/lib/data.ts` – `getSourcingDealStatus`, `isSourcingConsideredExpired`, `SOURCING_EXPIRED_BUFFER_MS`, `getSeedNow()` (stabil SEED_NOW)
- `src/app/beszerzesre-rendelheto/page.tsx` – aktív lista szűrés, serverNow
- `src/app/beszerzesre-rendelheto/BeszerzesreRendelhetoClient.tsx` – sessionStorage, hasMounted, displayProducts, onExpired
- `src/app/lejart-termekek/page.tsx` – lejárt lista, 5 napos ablak
- `src/components/SourcingDealCardCountdown.tsx` – számláló, serverNow, azonnali lejárt
- `src/components/SoldImpactOverlay.tsx` – logó + részecskék
- `src/components/ProductCard.tsx` – sold-impact wrapper, serverNow badge/countdown
- `src/app/globals.css` – `sold-impact-*`, `sold-logo-*`, `sold-card-*`, `sold-particle-*`
