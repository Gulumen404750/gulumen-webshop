# 50 kérdés – DB/ordersCount crash és javítás

Rövid, konkrét válaszok fájl- és kódrészletekkel.

---

1) **DATABASE_URL érték típusa?**  
A te `.env`-ben jelenleg `prisma+postgres://...` (Prisma lokál/Accelerate). Lehet `postgresql://user:pass@host:5432/db` is.

2) **isDbConfigured() mit ellenőriz?**  
Csak azt, hogy `process.env.DATABASE_URL` létezik és nem üres string. Kód: `src/lib/prisma.ts` – `Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')`.

3) **Miért vált DB módba, ha a DB nem elérhető?**  
Mert a rendszer csak az env-et nézi, nincs health check. Ha `DATABASE_URL` be van állítva, Prisma-t hívunk; ha a hálózat/szolgáltatás elérhetetlen, korábban dobott a query. Javítás: try/catch + JSON fallback, így nem váltunk “módba”, de DB hiba esetén nem omlik össze az app.

4) **Prisma client honnan jön?**  
`src/lib/prisma.ts` – onnan importáljuk.

5) **PrismaClient inicializálás: modul-szint vagy lazy?**  
Modul-szint (singleton): `globalForPrisma.prisma ?? new PrismaClient(...)` a fájl betöltésekor.

6) **“fetch data from service” a Prisma logban?**  
A `prisma+postgres://` URL Prisma Data Proxy / lokál Prisma Postgres szolgáltatást jelent; a “service” az a proxy/szolgáltatás. A “fetch failed” = a kliens nem tudott kapcsolódni ehhez a szolgáltatáshoz.

7) **Prisma Accelerate/Proxy használat?**  
A `.env`-ben lévő `prisma+postgres://localhost:51213/...` lokál Prisma Postgresra utal (pl. `prisma dev`). Ha ez nincs elindítva vagy a port zárva, “fetch failed”.

8) **prisma:// esetén helyes local fejlesztői beállítás?**  
Lokálhoz: vagy `postgresql://...` közvetlenül, vagy a Prisma Postgres szolgáltatás fusson (`prisma dev`). DIRECT_URL csak migrációhoz kell, ha Accelerate-ot használsz.

9) **.env.local-ban DIRECT_URL?**  
A jelenlegi schema-ban nincs `directUrl`; DIRECT_URL nem kötelező, csak Accelerate + migráció esetén.

10) **schema.prisma datasource directUrl?**  
Nincs. Csak `url = env("DATABASE_URL")`. Ha kell: `directUrl = env("DIRECT_URL")`.

11) **Supabase/Neon/Railway: él a projekt, nincs paused?**  
Ha `postgresql://`-t használsz, ellenőrizd a dashboardot (paused instance = kapcsolat megszakad).

12) **Dev gépről internet, tűzfal/proxy?**  
Ha a host nem localhost, a “fetch failed” lehet hálózati (tűzfal, proxy, DNS). Lokálban a szolgáltatás (pl. 51213) fusson.

13) **Node verzió, fetch/undici?**  
Next 14 + Prisma 6 – Node 18+ fetch alap. Kompatibilitási gond általában nem innen szokott lenni.

14) **prisma CLI vs @prisma/client verzió?**  
`package.json`: mindkettő `^6.0.0` – illeszkednek.

15) **npx prisma generate lefutott?**  
Módosítás után mindig: `npx prisma generate`.

16) **npx prisma migrate dev / deploy?**  
Közvetlen Postgres esetén: `migrate deploy`. Prisma Postgres (prisma+postgres) esetén a saját migrációjuk; lokál devnél gyakran automatikus.

17) **Order, OrderItem táblák léteznek?**  
A hiba “fetch failed”, nem “table not found” – a kapcsolat hiányzik, nem a schema.

18) **getProductOrdersCount melyik modell?**  
`prisma.orderItem` (camelCase a kliensben). Schema: `model OrderItem`.

19) **Schema model OrderItem → prisma.orderItem?**  
Igen. Prisma a modellnevet camelCase-re alakítja.

20) **qty mező neve?**  
`qty` – schema: `qty Int`.

21) **OrderItem productId?**  
Igen, `productId` (nem product_id). Schema: `productId String`.

22) **OrderItem orderId + relation Order?**  
Igen: `orderId`, `order Order @relation(...)`. Az `order: { status: { in: [...] } }` filter helyes.

23) **status mező típusa?**  
`Order.status` string (nincs enum a schemában).

24) **Status értékek egyeznek?**  
Igen: `payment_pending`, `sourcing_pending`, `fulfilled`, `paid` – ezek szerepelnek a kódban és a státuszokban.

25) **Miért van benne a 'paid'?**  
A sourcing limit “már rendelt” = fizetés alatt vagy már kifizetve. paid = már számít a limitbe.

26) **/beszerzesre-rendelheto: hány termékre fut a Promise.all?**  
Annyi, ahány sourcing deal termék (getSourcingDealProducts().length). Korábban N db külön getProductOrdersCount.

27) **Párhuzamos query burst → rate/connection limit?**  
Lehet. Javítás: egy batch (getProductOrdersCounts) groupBy-val, egy query.

28) **Prisma connection pooling?**  
Neon/Supabase esetén a kapcsolat stringben szokott lenni pooler URL. Prisma alapból kezeli a kapcsolatokat.

29) **DATABASE_URL connection_limit / pgbouncer?**  
Ha poolert használsz, a provider (Neon stb.) ad pooler URL-t. Opcionális paraméterek a dokumentáció szerint.

30) **Hiba minden query-re vagy csak burst miatt?**  
A “fetch failed” = a szolgáltatás (prisma+postgres) elérhetetlen. Akkor minden Prisma hívás dob. A burst csak sok hiba egyszerre.

31) **Ha csak 1 termékre hívod getProductOrdersCount-ot, akkor is fetch failed?**  
Igen, ha a DB/szolgáltatás elérhetetlen, egyetlen prisma hívás is dob.

32) **getProductOrdersCount-ban van try/catch? Miért nincs?**  
Korábban nem volt; ezért omlott össze a page. Javítás: try/catch + fallback (JSON vagy 0).

33) **Safe fallback javaslat:**  
Kész: DB hiba esetén `getProductOrdersCountFromJson(productId)` (ugyanaz a logika, loadOrders()-ból). Lista oldal: `getProductOrdersCountsFromJson(productIds)`.

34) **loadOrders() server componentben működik?**  
Igen. Node fs sync read a `process.cwd()`/data mappában. Vercel serverless Node runtime-ban működik. Edge-ben nem (nincs fs).

35) **Vercel/edge: JSON fájl?**  
Edge-ben az fs nem elérhető. A sourcing oldalak nem edge-specifikusak; default Node runtime.

36) **beszerzesre-rendelheto/page.tsx edge?**  
Nincs `export const runtime = 'edge'` – default Node.

37) **Prisma edge-ben?**  
Prisma hivatalosan nem edge. Nincs ilyen beállítás a projektben.

38) **CSP blokkolja a Prisma fetch-et?**  
Nem. A CSP a böngészőre vonatkozik. A Prisma fetch szerveren fut (Node).

39) **“prisma:warn Attempt 1/3 failed” – mi okozza a retry-t?**  
A Prisma kliens beépített retry (pl. 3 próba). A “fetch failed” a mögöttes hálózati/szolgáltatási hiba.

40) **Retry után miért nincs fallback?**  
Mert a kód nem catch-elt; a Prisma retry után továbbdobta a hibát. Most már try/catch van, és catch ágban JSON fallback.

41) **Minimális reprodukció:**  
Állítsd be a DATABASE_URL-t érvénytelenre vagy kapcsold ki a Prisma Postgres szolgáltatást, majd nyisd meg `/beszerzesre-rendelheto`. Korábban: runtime error. Javítás után: oldal betölt, ordersCount 0 vagy JSON-ból.

42) **Javítás lépések (env, generate, migrate, connect):**  
Lásd `docs/ENV.md`: (1) DATABASE_URL be/ki, (2) npx prisma generate, (3) migrate deploy ha postgresql://, (4) checkDbConnectivity() vagy egyszeri $queryRaw`SELECT 1`.

43) **Parancsok DB kapcsolat teszteléshez:**  
- `npx prisma generate`  
- `npx prisma migrate deploy` (ha közvetlen Postgres)  
- Kódban: `import { checkDbConnectivity } from '@/lib/prisma'; await checkDbConnectivity()` (vagy health route).

44) **DB connectivity check helper:**  
Megvan: `src/lib/prisma.ts` – `checkDbConnectivity()`: `prisma.$queryRaw\`SELECT 1\`` try/catch, eredmény ~60 s cache.

45) **isDbConfigured() nézzen elérhetőséget is?**  
Nem változtattuk. Csak env marad; az elérhetőséget a try/catch kezeli (getProductOrdersCount / getProductOrdersCounts). Ha isDbConfigured() is pingelné a DB-t, minden hívás késleltetett lenne és DB down-nál lassú lenne.

46) **Promise.all helyett 1 batch groupBy?**  
Igen. Új: `getProductOrdersCounts(productIds: string[])` – egy `prisma.orderItem.groupBy` by productId, _sum qty, where productId in és order.status in.

47) **getProductOrdersCounts(productIds[]) batch:**  
Megvan `src/lib/orders.ts`-ben: groupBy productId, _sum qty, where productId in productIds és order.status in SOURCING_COUNT_STATUSES. Visszatérés: Record<string, number>. Hiba esetén getProductOrdersCountsFromJson(productIds).

48) **Termékoldal ordersCount safe:**  
A termékoldal továbbra is `getProductOrdersCount(product.id)`-t hívja. A biztonság a lib-ben van: getProductOrdersCount try/catch + getProductOrdersCountFromJson fallback.

49) **Local dev: nincs DB → automatikus JSON?**  
Ha nem állítod be a DATABASE_URL-t, isDbConfigured() false → minden orders/getProductOrdersCount JSON. Ha beállítod, de a szolgáltatás elérhetetlen, try/catch miatt JSON fallback. Tehát: vagy ne add meg a DATABASE_URL-t, vagy használj működő URL-t; mindkét esetben az app nem omlik össze.

50) **Konkrét patch csomag (fájllista + összefoglaló):**  
Lásd alább.

---

## Patch összefoglaló

### Módosított/új fájlok

| Fájl | Változás |
|------|----------|
| `src/lib/orders.ts` | getProductOrdersCount: try/catch, hiba esetén getProductOrdersCountFromJson. Új: getProductOrdersCountFromJson, getProductOrdersCountsFromJson, getProductOrdersCounts(productIds) batch groupBy + try/catch + JSON fallback. |
| `src/lib/prisma.ts` | checkDbConnectivity() (SELECT 1, ~60 s cache). Komment: isDbConfigured() csak env. |
| `src/app/beszerzesre-rendelheto/page.tsx` | Promise.all helyett getProductOrdersCounts(productIds) egy hívással, majd map products → ordersCount a map-ból. |
| `docs/ENV.md` | Új: DATABASE_URL, DIRECT_URL, JWT_SECRET, kapcsolat teszt, összefoglaló táblázat. |
| `docs/DB_ORDERS_COUNT_50_ANSWERS.md` | Ez a 50 kérdés válaszok. |

### Mit ér el a patch

- DB “fetch failed” esetén a `/beszerzesre-rendelheto` és a termékoldal nem dob, hanem JSON-ból (vagy 0) számol ordersCount-ot.
- Lista oldal: egy batch query (groupBy), N helyett 1 DB hívás; hiba esetén JSON fallback.
- Opcionális health check: checkDbConnectivity().
- Dokumentáció: ENV és DIRECT_URL/JWT_SECRET.

### Teszt

- DATABASE_URL üres vagy hibás / szolgáltatás le: nyisd meg `/beszerzesre-rendelheto` és egy sourcing termék oldalt → betölt, 0 vagy JSON alapú szám.
- DATABASE_URL érvényes, DB fut: ugyanúgy működik, de valós DB számmal.
