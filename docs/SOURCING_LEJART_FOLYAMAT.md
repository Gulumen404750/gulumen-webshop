# Sourcing: lejárt ajánlatok folyamata (ahogy most van)

Ez a doc a **Beszerzésre rendelhető** és **Lejárt termékek** oldal jelenlegi viselkedését írja le: hogyan kerül egy termék a lejárat után a Lejárt termékek közé, és miért nem indul újra a számláló frissítéskor.

---

## 1. Időforrás és „lejártnak tekintés”

- **Szerver:** minden requestnél `serverNow = Date.now()` (beszerzesre-rendelheto/page.tsx, lejart-termekek/page.tsx). `revalidate = 0`, `dynamic = 'force-dynamic'`, nincs cache.
- **Kliens számláló:** a szervertől kapott `serverNow`-t használja, és `serverNow + (Date.now() - clientRef)`-fel számolja a „most”-ot (SourcingDealCardCountdown). Frissítéskor mindig az aktuális `serverNow` felülírja a localStorage ref-et.
- **Buffer (kliens–szerver óra eltérés):** `SOURCING_EXPIRED_BUFFER_MS = 30_000` (30 mp). Ha `saleTo <= serverNow + buffer`, a termék **már lejártnak tekintendő** (data.ts: `isSourcingConsideredExpired()`).
- **Stabil seed (mock):** `getSeedNow()` a globalThis-ben tárolja az első időpontot, így a teszt termék (sd-test-timer) 5 perc után a szerveren is lejárt marad; modul újratöltéskor nem indul újra a 5 perc.

---

## 2. Beszerzésre rendelhető oldal (aktív lista)

**Szerver (page.tsx):**

1. `getSourcingDealProducts()` + `getProductOrdersCounts()` → `products` + `ordersCount`.
2. `serverNow = Date.now()`.
3. **Aktív lista:** csak olyan termékek, ahol
   - `!isSourcingConsideredExpired(p, serverNow)` (tehát saleTo > serverNow + 30 s),
   - és `getSourcingDealStatus(...) === 'preview' || 'sale'`.
4. A szűrt lista + `serverNow` átadódik a `BeszerzesreRendelhetoClient`-nek.

**Kliens (BeszerzesreRendelhetoClient):**

- **Hydration:** első renderen `hasMounted === false` → `displayProducts = products` (szerverrel azonos, nincs sessionStorage szűrés), így nincs hydration hiba. Mount után (`useLayoutEffect`) sessionStorage-ból töltjük a rejtett id-ket.
- **Megjelenített lista:** mount után `displayProducts = products.filter(...)` ahol kiszűrjük a `clientSideHiddenExpiredIds` és `hiddenExpiredRef` (sessionStorage-ból betöltött) id-kat; animálódó termék mindig látszik.
- **sessionStorage kulcs:** `gulumen_sourcing_hidden_expired` (lejárt termék id-k tömbje).
- **onExpired(productId):**
  1. `addToStoredHiddenExpiredIds(productId)` (sessionStorage) + `expiredAnimatingIds` → megjelenik a „lejárt” overlay (animáció).
  2. 8 s múlva (SOLD_ANIMATION_DURATION_MS): `clientSideHiddenExpiredIds` + ref frissül, majd `router.refresh()`.
- **Eredmény:** a lejárt termék az animáció után kikerül a listából; refresh után a szerver nem adja vissza (stabil SEED_NOW + szigorú szűrés); ha mégis, a kliens sessionStorage miatt nem jeleníti meg.

---

## 3. Számláló (SourcingDealCardCountdown)

- **Idő:** ha van `serverNowProp`, azzal számol: `serverNowProp + (Date.now() - clientRef)`; 1 mp-es tick.
- **Ha a szerver szerint már lejárt:** ha `serverNowProp`-pal számolva `getSourcingDealStatus` → `closed` vagy `soldout`, azonnal „Hamarosan archiválásra kerül” + `onExpired(product.id)` (nem vár a tickre).
- **Lejárat a tickkel:** ha `nowMs` szerint `closed`/`soldout` → „Hamarosan archiválásra kerül” + egyszer meghívott `onExpired`.

---

## 4. Lejárt termékek oldal

**Szerver (lejart-termekek/page.tsx):**

- Ugyanaz a `isSourcingConsideredExpired(p, serverNow)`:
  - bekerül, ha **lejártnak tekintendő** (saleTo ≤ serverNow + 30 s),
  - és `saleTo >= serverNow - 5 nap` (EXPIRED_WINDOW_MS).
- Így a Beszerzésre rendelhetőről „lejártnak tekintett” termék **ugyanazzal a küszöbbel** a Lejárt termékek között jelenik meg (nincs „sehol sem” állapot).

---

## 5. Összefoglaló (lépések)

| Lépés | Hol | Mi történik |
|-------|-----|-------------|
| 1 | Szerver | Aktív lista: csak nem lejárt (status preview/sale és nem `isSourcingConsideredExpired`). |
| 2 | Kliens | Számláló a `serverNow`-ból számolt „most”-tal; ha szerver szerint már lejárt → azonnal „Hamarosan archiválásra kerül” + onExpired. |
| 3 | Kliens | Lejárat (tick vagy azonnali): onExpired → animáció → 8 s után productId sessionStorage + state/ref, majd router.refresh(). |
| 4 | Kliens | Lista: első render = szerver listája (hasMounted false); mount után displayProducts kiszűri a sessionStorage + state/ref rejtett id-kat → lejárt nem jelenik meg újra. |
| 5 | Szerver | Refresh után aktív lista továbbra is `isSourcingConsideredExpired`-del szűr; ha buffer miatt lejártnak számít, nem kerül vissza. |
| 6 | Lejárt oldal | Ugyanazzal a `isSourcingConsideredExpired` + 5 napos ablak: a termék a Lejárt termékek között megjelenik. |

---

## 6. Fontos fájlok

- `src/lib/data.ts` – `getSourcingDealStatus`, `isSourcingConsideredExpired`, `SOURCING_EXPIRED_BUFFER_MS`
- `src/app/beszerzesre-rendelheto/page.tsx` – aktív lista szűrés
- `src/app/beszerzesre-rendelheto/BeszerzesreRendelhetoClient.tsx` – `clientSideHiddenExpiredIds`, `displayProducts`, onExpired
- `src/app/lejart-termekek/page.tsx` – lejárt lista szűrés
- `src/components/SourcingDealCardCountdown.tsx` – számláló, serverNow, azonnali lejárt kezelés

**Folyamatok áttekintés:** [FOLYAMATOK.md](./FOLYAMATOK.md)
