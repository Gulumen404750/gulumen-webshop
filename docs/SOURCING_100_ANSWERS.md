# 100 kérdés – Időzített sourcing inkonzisztencia (válaszok a kódbázis alapján)

---

## 🔹 I. Dátumformátum és időzóna (1–20)

| # | Kérdés | Válasz |
|---|--------|--------|
| 1 | Pontosan milyen formátumban vannak a saleFrom és saleTo értékek a src/lib/data.ts-ben? | **ISO 8601**, pl. `"2025-03-01T12:00:00.000Z"`. Generálás: `addDays(now, n)` / `addMinutes(now, n)` → `return out.toISOString()` (data.ts ~529–537). |
| 2 | Tartalmaznak Z-t (UTC jelölést)? | **Igen.** `Date.prototype.toISOString()` mindig Z-t ad (UTC). |
| 3 | Tartalmaznak explicit offsetet (pl. +01:00)? | **Nem.** Csak Z (UTC), nincs +01:00 stb. |
| 4 | Van-e olyan termék, ahol nincs timezone megadva? | **Nem.** Minden sourcing_deal terméknek van `saleFrom` és `saleTo`; a string maga UTC (Z), timezone a formátumból adódik. |
| 5 | A dátum string ISO 8601 szabványos? | **Igen.** `toISOString()` output ISO 8601 kompatibilis. |
| 6 | Használunk-e new Date(string)-et közvetlenül? | **Igen.** Pl. data.ts: `new Date(product.saleFrom).getTime()`, `new Date(product.saleTo).getTime()`; SourcingDealBox, SourcingDealCardCountdown ugyanígy. |
| 7 | Van-e custom date parse függvény? | **Nem.** Csak natív `new Date(string)`. |
| 8 | Node és böngésző ugyanúgy parse-olja a jelenlegi dátumformátumot? | **Igen.** ISO 8601 Z stringet mindkettő UTC-ként értelmezi, azonos epoch ms-t ad. |
| 9 | Milyen timezone-ban fut a Node dev szerver? | **A kód nem állítja.** Rendszer / környezet alapértelmezetten (pl. Windows: lokális időzóna). |
| 10 | Milyen timezone-ban van a Windows rendszer? | **Kód nem ellenőrzi.** A felhasználó rendszere (pl. Europe/Budapest). |
| 11 | process.env.TZ be van állítva? | **Nincs ilyen beállítás a kódban.** Ha nincs a környezetben, Node a rendszer időzónáját használja. |
| 12 | Server logban kiírható a new Date().toString()? | **Jelenleg nincs ilyen log.** Hozzá lehet adni pl. a checkout vagy a termékoldal renderjéhez. |
| 13 | Client oldalon mit ad new Date().toString()? | **Nincs ilyen log a kódban.** Böngésző lokális időzónában ad pl. "Tue Feb 17 2025 14:30:00 GMT+0100 (közép-európai idő)". |
| 14 | Van-e eltérés a kettő között? | **Lehet.** Ha a szerver és a kliens időzónája vagy rendszerórája eltér, a stringek és a “most” értelmezése különbözik. |
| 15 | A saleFrom időpont a jövőben van valóban? | **Termékfüggő.** Mock adatban: sd-test-timer: 2 perc múlva; sd-1, sd-3 stb.: napok múlva; sd-2, sd-9–sd-15: egyeseknek saleFrom már múlt (addDays(now, -1)). |
| 16 | A countdown kliensben a Date.now()-ot használja? | **Igen.** SourcingDealCardCountdown: `setNow(Date.now())`, 1 s interval. SourcingDealBox: `setNow(new Date())` – gyakorlatilag ugyanaz. |
| 17 | A szerver oldalon a státusz meghatározás is Date.now()? | **Nem közvetlenül.** Szerveren `new Date()` (pl. checkout `const now = new Date()`). Epoch szempontból egyezik. |
| 18 | Van-e valahol toISOString()-re konvertálás? | **Igen.** data.ts `addDays` / `addMinutes`: `return out.toISOString()`. orders.ts, payment-transactions, loyalty stb. toISOString a belső adathoz, nem a saleFrom/saleTo-hoz. |
| 19 | Lehetséges, hogy saleFrom local time-ként lett generálva? | **Nem.** A generálás: `new Date()` (szerver lokális idő) → setDate/setMinutes → `toISOString()` → mindig UTC string. A *érték* a szerver “most”-jából számolt UTC időpont. |
| 20 | A saleTo kisebb lehet, mint saleFrom parse hiba miatt? | **Normál esetben nem.** Ugyanaz a parse (`new Date(string)`), konzisztens adat. Rossz adatnál (pl. felcserélt string) elméletben lehet. |

---

## 🔹 II. Server vs Client időforrás (21–40)

| # | Kérdés | Válasz |
|---|--------|--------|
| 21 | A sourcing státusz számítása hol történik? (server/lib?) | **Lib:** `getSourcingDealStatus` és `getTimedPurchaseStatus` a `src/lib/data.ts`-ben. Meghívják: szerver (termékoldal, lista, checkout) és kliens (SourcingDealBox, SourcingDealCardCountdown). |
| 22 | A termékoldal Server Component? | **Igen.** `src/app/termek/[slug]/page.tsx` async Server Component; a gyerek `ProductPageContent` Client Component. |
| 23 | A countdown Client Component? | **Igen.** SourcingDealCardCountdown és SourcingDealBox egyaránt `'use client'`. |
| 24 | A countdown saját maga számolja a státuszt? | **Igen.** Mindkettő: `getSourcingDealStatus(product, new Date(now), effectiveCount)` / `nowOrEpoch`, ahol `now` useState, mount után beállítva. |
| 25 | A státusz logika kétszer van implementálva? | **Nem külön implementáció.** Egy helyen van (data.ts), de **kétszer számolódik**: egyszer szerver (render/request időpont), egyszer kliens (mount + 1 s tick). |
| 26 | Van közös getTimedPurchaseStatus()? | **Igen.** data.ts; checkout, create-checkout-session, fizetes page, SourcingDealBox mind ezt hívják. |
| 27 | A checkout ugyanazt a függvényt hívja? | **Igen.** checkout/route.ts: `getTimedPurchaseStatus(product, now, ordersCount)`. |
| 28 | A szerver oldali státusz render időben számolódik? | **Igen.** Pl. termékoldal: `getProductBySlug` + `getProductOrdersCount` után a product átadódik; a *státusz* a kliens komponensekben a kliens “now”-ral számolódik. A szerver nem ad “státusz” értéket, csak productot ordersCount-tal. |
| 29 | A kliens oldali státusz mount után számolódik? | **Igen.** useEffect: setNow(...), majd 1 s interval; ezzel a now-val getSourcingDealStatus / getTimedPurchaseStatus. |
| 30 | Van-e eltérés 1–2 másodperc határon? | **Lehet.** Ha a felhasználó pont a saleFrom/saleTo határánál van, a szerver “now” és a kliens “now” 1–2 mp különbsége más státuszt adhat. |
| 31 | Ha a saleFrom pontosan most van, mit csinál a rendszer? | **t >= saleFrom → 'sale'.** data.ts: `if (t >= saleFrom) return 'sale'`. Nincs speciális “pont most” kezelés. |
| 32 | A boundary condition kezelve van? | **Nincs külön kezelés.** Csak t &lt; saleFrom → preview, t >= saleFrom → sale, t > saleTo → closed. |
| 33 | A countdown interval 1000ms? | **Igen.** SourcingDealBox: `setInterval(..., 1000)`; SourcingDealCardCountdown: `setInterval(() => setNow(Date.now()), 1000)`. |
| 34 | Az első render előtt a státusz fix? | **Countdown UI fix:** SourcingDealBox: `showPlaceholder = !mounted \|\| now === null` → "—"; SourcingDealCardCountdown: `now === null` → return null. Státusz számítás kliensen csak mount után van. |
| 35 | Használunk hydration utáni státusz újraszámítást? | **Igen.** useEffect beállítja a now-ot, ezért hydration után a státusz a kliens idővel újraszámol. |
| 36 | A Server Component átadja a "now" timestampet? | **Nem.** Csak a `product` (ordersCount-tal) megy a Client Componentnek; a “now” mindig a kliens saját `Date.now()` / `new Date()`. |
| 37 | Van offset számítás? | **Nincs.** Nincs serverNow – clientNow vagy időzóna offset. |
| 38 | Inkognitó és normál ugyanazt a serverNow-t kapja? | **A szerver “now”-t egyáltalán nem kapja a kliens.** A kapott HTML/cache ugyanaz; a kliens mindkét ablakban a saját óráját használja. |
| 39 | Lehet, hogy a kliens saját óráját használja eltérően? | **Igen.** A kliens mindenhol saját `Date.now()` / `new Date()` – ez lehet eltérő a szerver órájától (NTP, időzóna, user beállítás). |
| 40 | A hydration során van UI flicker? | **Lehet.** SourcingDealBox: először "—", mount után countdown szöveg. SourcingDealCardCountdown: null → tartalmi blokk. Rövid flicker elfogadható. |

---

## 🔹 III. ISR / Cache / Revalidate (41–60)

| # | Kérdés | Válasz |
|---|--------|--------|
| 41 | A sourcing lista oldalon mennyi a revalidate? | **30.** beszerzesre-rendelheto/page.tsx: `export const revalidate = 30`. |
| 42 | A termékoldalon mennyi a revalidate? | **30.** termek/[slug]/page.tsx: `export const revalidate = 30`. |
| 43 | Használunk-e cache: 'no-store'-t? | **Nem.** A sourcing oldalak nem fetch-elnek ilyen opcióval; adat data.ts + orders-ból jön. |
| 44 | Inkognitó vs normál eltérő cache-t kap? | **Az oldal cache (ISR) nem session-specifikus.** Ugyanazt a cached HTML-t kaphatják; cookie/session más lehet. |
| 45 | A normál ablak kaphat 30 mp-es stale HTML-t? | **Igen.** revalidate=30 miatt legfeljebb 30 mpig nem frissül a generált HTML. |
| 46 | A boundary közelében cache okozhat eltérést? | **Igen.** Stale HTML pl. 25 mpja készült; a countdown a kliens “now”-ját használja. Ha a sale pont abban a 30 mp ablakban van, a “látszó” státusz és a checkout szerver státusza eltérhet. |
| 47 | A Server Component újrarenderelődik boundary után? | **revalidate=30:** 30 mp elteltéig nem; utána a következő request triggerelheti az újrarenderelést. |
| 48 | A countdown a stale HTML-re fut rá? | **Igen.** A countdown a kapott product adattal (saleFrom, saleTo, ordersCount) dolgozik; az ordersCount a (lehet hogy 30 mp-os) renderkor volt. |
| 49 | A checkout mindig friss számítást csinál? | **Igen.** API route: minden kérésnél `new Date()` és `await getProductOrdersCount(...)`. |
| 50 | A listaoldal statikus generált? | **ISR:** statikusan generált, 30 mp revalidate-tal. |
| 51 | Az időzített státusz cache-elődik? | **Nem külön.** De a HTML, amiben a státuszhoz használt product (pl. ordersCount) benne van, cache-elt – tehát a státuszhoz használt adat lehet régi. |
| 52 | Lehet-e, hogy egyik ablak friss, másik régi? | **Igen.** Ha az egyik 30 mp után tölt, a másik előtte, a cache különböző lehet. |
| 53 | Revalidate=30 túl sok boundary-nál? | **Lehet.** Ha a sale indul/lejár határán kritikus a pontosság, 30 mp nagy ablakot ad az inkonzisztenciára. |
| 54 | Teszteltük revalidate=0-val? | **A kódban nincs revalidate=0.** |
| 55 | Revalidate=0-nál megszűnik az eltérés? | **Csökkentheti.** Minden request újrarenderel, friss ordersCount és “most” – de kliens óra vs szerver óra eltérés továbbra is lehet. |
| 56 | Használunk Vercel edge cache-t? | **next.config nem állít külön cache-t.** Alap Next.js viselkedés. |
| 57 | Dev módban is van ISR? | **Nem.** Next.js dev-ben a revalidate gyakran nem alkalmazható / mindig frissül a lap. |
| 58 | Van fetch cache revalidation valahol? | **Nincs releváns fetch** a sourcing lista/termék oldalakon (adat lib + orders). |
| 59 | A DB fallback befolyásolja a cache-t? | **Közvetlenül nem.** A cache-elt HTML a renderkor kapott (DB vagy JSON) ordersCount-ot tartalmazza. Ha akkor DB down volt, a render JSON fallbackkal történt. |
| 60 | A szerver log mutat több render időpontot? | **Nincs ilyen log a kódban.** |

---

## 🔹 IV. Checkout validáció (61–75)

| # | Kérdés | Válasz |
|---|--------|--------|
| 61 | A checkout milyen függvénnyel validál? | **getTimedPurchaseStatus(product, now, ordersCount).** checkout/route.ts ~155. |
| 62 | Ugyanaz a státusz logika van ott? | **Igen.** getTimedPurchaseStatus → getSourcingDealStatus (data.ts). |
| 63 | A checkout a DB-s ordersCount-et használja? | **Igen.** `const ordersCount = await getProductOrdersCount(item.productId)` (DB, vagy JSON fallback). |
| 64 | A checkout a szerver idejét használja? | **Igen.** `const now = new Date()` a POST elején. |
| 65 | A checkout logolható? | **Részben.** logger.debug (pl. validation failed, checkout completed), de a státusz/now/ordersCount nincs részletesen logolva. |
| 66 | A checkout hiba akkor jön, ha status !== sale? | **Ha timedStatus !== 'ACTIVE'.** 400 + "One or more timed offers are no longer available...". |
| 67 | A checkout külön parse-olja a dátumot? | **Nem.** getProductById → product; getTimedPurchaseStatus belül new Date(product.saleFrom/saleTo) (data.ts). |
| 68 | A checkout előtt a kosárban státusz ellenőrzés van? | **Igen, kliens oldalon.** fizetes/page.tsx: getTimedPurchaseStatus(product, now) !== 'ACTIVE' → setError. De **ordersCount nincs átadva** – a product a korábbi page load adat (ordersCount lehet régi). |
| 69 | A kosár UI frissíti a státuszt? | **Nem.** Nincs polling vagy újrafetch a kosárban a sourcing státuszra. |
| 70 | A checkout kérés időpontja boundary-n túl van? | **Ha a kérés időpontjában már t > saleTo vagy t < saleFrom**, a szerver ACTIVE-tól eltérőt ad → 400. |
| 71 | A checkout request latency számít? | **Csak a “now” számít.** A now a kérés feldolgozásának elején van; a latency nem változtatja meg a now-ot. |
| 72 | A checkout hiba fixen reprodukálható? | **Igen.** Pl. sale lejárta után kattintás, vagy cache (stale ordersCount) + boundary. |
| 73 | Minden sourcing terméknél előjön? | **Nem feltétlen.** Ha a státusz és ordersCount mindkét oldalon konzisztens, nem jön. Boundary + cache/óra eltérésnél jellemző. |
| 74 | Csak preview fázisnál jön? | **Nem.** Preview (NOT_STARTED) és lejárt (EXPIRED) egyaránt nem ACTIVE → 400. |
| 75 | Csak lejárat határán jön? | **Gyakori a határon.** Lejárat (és indulás) pillanatában a kliens/szerver óra és a cache különböző “most”-ot adhat. |

---

## 🔹 V. DB fallback hatása (76–85)

| # | Kérdés | Válasz |
|---|--------|--------|
| 76 | A DB fallback befolyásolja a státuszt? | **Közvetlenül nem**, de a **ordersCount** befolyásolja: getSourcingDealStatus count >= maxOrders → soldout. Fallback más count-ot adhat → más státusz. |
| 77 | A DB fallback csak ordersCount-et érinti? | **Igen.** getProductOrdersCount / getProductOrdersCounts: try DB → catch esetén getProductOrdersCountFromJson. |
| 78 | A státusz számítás ordersCount-tól függ? | **Igen.** count >= maxOrders → soldout; getTimedPurchaseStatus soldout/closed → EXPIRED. |
| 79 | Ha ordersCount=0, az lehet soldout? | **Nem.** soldout csak ha count >= maxOrders (maxOrders > 0). |
| 80 | A getTimedPurchaseStatus figyeli maxOrders-et? | **Közvetve.** getTimedPurchaseStatus → getSourcingDealStatus, ami maxOrders-t és count-ot használ. |
| 81 | Ha maxOrders=0, az preview? | **getSourcingDealStatus:** maxOrders == null → null; maxOrders=0 nem null, így count >= 0 azonnal soldout (preview/sale előtt is). |
| 82 | A fallback JSON és DB eltérő adatot ad? | **Lehet.** Ha a DB és a data/orders.json nincs szinkronban, eltérő ordersCount. |
| 83 | Lehet eltérés inkognitó vs normál közt JSON miatt? | **A JSON/DB eltérés nem session-függő.** Inkognitó vs normál ugyanazt a server render (ordersCount) kapja; a különbség a kliens “now” és a cache lehet. |
| 84 | A JSON file frissült? | **loadOrders()** memóriában cache-el (memoryStore, loaded). Első olvasás után a fájl változása **nem** jelenik meg, amíg a folyamat él. |
| 85 | A DB query latency okoz boundary csúszást? | **Lehet.** Lassú getProductOrdersCount → a checkout “now” később számít → boundary közelében más státusz (pl. már EXPIRED). |

---

## 🔹 VI. Countdown implementáció (86–95)

| # | Kérdés | Válasz |
|---|--------|--------|
| 86 | A countdown a saleTo-t használja? | **Igen.** sale fázisban: SourcingDealBox countdownToEnd = saleTo - nowMs; SourcingDealCardCountdown formatCountdownDDHHMMSS(saleTo - nowMs). |
| 87 | A countdown a saleFrom-ot is figyeli? | **Igen.** Preview: countdown saleFrom-ig (SourcingDealBox: countdownToSale; SourcingDealCardCountdown: saleFrom - nowMs). |
| 88 | A countdown csak vizuális vagy státuszt is vált? | **Nem vált önállóan.** Ugyanazzal a getSourcingDealStatus-tal számolt státusszal jelenik meg a gomb/UI; a státusz ugyanazzal a now-tal számolódik. |
| 89 | A countdown nullázáskor újraszámolja státuszt? | **Nem külön.** saleTo lejárta után status → closed, a UI "Lejárt" / closed szöveget mutat; nincs külön “nullázás és újraszámolás”. |
| 90 | A countdown első renderkor mi történik? | **SourcingDealBox:** placeholder "—". **SourcingDealCardCountdown:** now === null → return null. Mount után useEffect beállítja now-ot, megjelenik a countdown. |
| 91 | A countdown hydration után változtat UI-t? | **Igen.** setNow(...) → új status/countdown → UI frissül (1 s-enként). |
| 92 | A countdown server-renderelt HTML eltér a kliensestől? | **Igen.** Szerveren: placeholder / null. Kliensen: countdown szöveg. Ez szándékos (hydration mismatch elkerülés). |
| 93 | Van React hydration mismatch warning? | **Nem kell.** Placeholder "—" és null első renderre csökkenti a mismatch lehetőségét. |
| 94 | A countdown Date.now()-ot közvetlenül használ? | **SourcingDealCardCountdown:** setNow(Date.now()). **SourcingDealBox:** setNow(new Date()) – gyakorlatilag ugyanaz. |
| 95 | Van offset korrekció? | **Nincs.** Nincs kliens–szerver offset vagy időzóna korrekció. |

---

## 🔹 VII. Inkognitó vs normál különbség (96–100)

| # | Kérdés | Válasz |
|---|--------|--------|
| 96 | Inkognitóban más cache policy? | **Az oldal (ISR) cache ugyanaz.** Next.js nem különböztet session/cookie alapján a page cache szintjén. |
| 97 | Normál ablakban localStorage befolyásolja? | **Nem a sourcing státuszt.** Pl. recently viewed (ProductPageContent) localStorage – nem időzítés. Kosár lehet localStorage/session – nem változtatja a saleFrom/saleTo értelmezését. |
| 98 | Van session alapú viselkedés? | **Nincs** session alapú sourcing státusz; mindig product + now + ordersCount. |
| 99 | Inkognitóban friss render miatt más státusz? | **Lehet.** Ha inkognitó első látogatás (nincs cache), a szerver friss HTML-t ad; normál ablakban lehet régi cache. Vagy fordítva – így “most” és ordersCount kombinációban más státusz látszik. |
| 100 | Ha mindkettőt egyszerre frissíted boundary után, akkor egyeznek? | **Nem feltétlen.** Ha ugyanaz a cached HTML és ugyanaz a kliens idő (pl. ugyanabban a másodpercben), egyezhetnek. Ha különböző cache (pl. egyik már revalidált) vagy eltérő kliens óra, továbbra is lehet eltérés. |

---

## Összefoglaló – fő inkonzisztencia források

1. **Kliens vs szerver “now”** – A szerver nem ad át “now”-t; a kliens saját óráját használja. Boundary-nál 1–2 mp is eltérést okozhat.
2. **revalidate=30** – Stale HTML (ordersCount és implicit “render time”) 30 mpig; countdown a kliens “now”-jával számol → státusz és checkout eltérés.
3. **Fizetés oldal ordersCount** – getTimedPurchaseStatus(product, now) **ordersCount override nélkül** – a product.ordersCount a korábbi page load, nem friss.
4. **create-checkout-session** – getTimedPurchaseStatus(product, now) **ordersCount nélkül** – ellentétben a checkout route-tal, ami használja a getProductOrdersCount-ot.
5. **JSON orders cache** – loadOrders() memóriában cache-el; a data/orders.json változása a folyamat életében nem látszik.

*A dokumentum a jelenlegi kódbázis alapján készült (src/lib/data.ts, orders.ts, checkout, termékoldal, SourcingDealBox, SourcingDealCardCountdown, revalidate, stb.).*
