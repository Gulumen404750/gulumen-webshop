# Projekt elemzés – Gulumen webshop (kódbázis alapján)

A válaszok a jelenlegi kódbázis alapján készültek. Ha valami nincs implementálva, az „nem található a kódbázisban” vagy konkrétummal van jelölve.

---

## 1. Hol van a projekt deployolva jelenleg?

**Nem található a kódbázisban.**  
Nincs explicit deploy URL vagy „production” cím a repóban. A **Vercel** a konfigurációból következik: `vercel.json` (cron), `.gitignore`-ban `.vercel`, és a docs (pl. `docs/ARCHITEKTURA_ELEMZES.md`, `docs/ENV.md`) Vercel / Railway / Render megemlítése deployment célhelyként. A tényleges éles URL (pl. gulumen.hu) csak a `NEXT_PUBLIC_APP_URL` / `BASE_URL` példákban szerepel (`https://gulumen.hu`), nem deploy konfigként.

---

## 2. Van-e CI/CD vagy automatikus deploy GitHubból?

**Nem található a kódbázisban.**  
Nincs `.github/workflows` vagy más CI/CD konfig (GitHub Actions, GitLab CI, Circle CI stb.). A deploy valószínűleg a hosting platform (pl. Vercel) „Git push = deploy” funkciójával történik, ami nincs a repóban konfigurálva.

---

## 3. Van-e `.github/workflows` vagy más build pipeline?

**Nem.**  
A projekt gyökérben és a `.github` mappában egyetlen workflow fájl sem található. Build parancs: `next build` (package.json); futtatás platform-specifikus (pl. Vercel automatikus build).

---

## 4. Van-e analytics rendszer?

**Igen.**  
- **Fájl:** `src/lib/analytics.ts`, `src/components/Analytics.tsx`.  
- **Google Analytics 4:** `NEXT_PUBLIC_GA_MEASUREMENT_ID` env; ha megvan, a `gtag` (googletagmanager.com) betöltése és események: `pageView`, `add_to_cart`, `begin_checkout`, `purchase`.  
- **Plausible:** opcionális – ha a `window.plausible` létezik (külső script), ugyanezek az események kimennek (`pageview`, `add_to_cart`, `begin_checkout`, `purchase`).  
- A layout (`src/app/layout.tsx`) tartalmazza az `<Analytics />` komponenst; a fizetés kezdete és a sikeres vásárlás oldal hívja a `trackBeginCheckout` / `trackPurchase` függvényeket.

---

## 5. Van-e SEO optimalizáció?

**Igen.**  
- **Metadata:** `layout.tsx` exportál `metadata` (title, description, openGraph, stb.); `termek/[slug]/layout.tsx` – `generateMetadata` termék alapján (név, kategória, ár, condition); `lejart-termekek/page.tsx` – saját metadata.  
- **Sitemap:** `src/app/sitemap.ts` – dinamikus sitemap: statikus oldalak, kategóriák, termékek (mockProducts + categories a `data.ts`-ból), `lastModified`, `changeFrequency`, `priority`.  
- **Robots:** `src/app/robots.ts` – allow `/`, disallow: `/api/`, `/fizetes`, `/kosar`, `/profil`, `/regisztracio`, `/kedvencek`, `/admin`; sitemap URL.  
- **Structured data:** `ProductJsonLd.tsx`, `OrganizationJsonLd.tsx` (JSON-LD) a termékoldalon és a layoutban.

---

## 6. Van-e termék kereső funkció?

**Igen.**  
- **SearchModal** (`src/components/SearchModal.tsx`): kereső mező, a beírt szó a `/termekek?kereses=<q>` query paraméterrel nyitja a terméklistát.  
- **ShopContent** (`src/components/ShopContent.tsx`): a `kereses` query param alapján szűr: `matchesSearch(product, search, locale)` – név (name, nameEn stb.) és kategória alapján.  
- A headerben kereső gomb nyitja a SearchModal-t; a 404 oldalon is van kereső űrlap ugyanerre.

---

## 7. Van-e termék ajánló rendszer?

**Részlegesen.**  
- **AI chatbot** a system promptban azt írja: „Ajánlj maximum 1–2 hasonló terméket”, „Ha a vásárló bizonytalan, elsőként táskát ajánlj” – de a chatbot **nem kap terméklistát** a kódból, csak szöveges instrukciót. Konkrét termék ID/név/ár nincs átadva az API-nak, tehát nincs valós „ajánló motor” a termékadatokra építve.  
- **Rule-based fallback** (`ai-assistant.ts`): az „ajánl” kulcsszóra `ai.recommend` fordítási kulcsot ad, általános szöveggel.  
- **Dedikált „recommendation engine” (pl. „ehhez a termékhez ezt is vedd meg”) nem található a kódbázisban.

---

## 8. A chatbot hozzáfér-e a termékadatbázishoz?

**Nem.**  
A `/api/chat` route csak a felhasználó üzenetét és a locale-ot kapja. Az OpenAI hívásnak csak a `SYSTEM_PROMPT` (fix szöveg) és a user message kerül át; nincs `getProducts()`, `mockProducts` vagy más termékadat injektálás. A termékadat a `src/lib/data.ts`-ben van, a chat route nem importálja és nem adja tovább.

---

## 9. Tud-e a chatbot terméket ajánlani?

**Csak általános szinten.**  
A system prompt és a fallback szövegek szerint „ajánlj terméket” / „böngéssz” – de mivel nincs termékadat a chatben, a modell nem tud konkrét terméknevet, árat vagy linket mondani. Ha az OpenAI válaszában terméknevek vannak, az a modell általános tudásából / promptból származik, nem a webshop adatbázisából.

---

## 10. Tud-e a chatbot rendelést indítani?

**Nem.**  
A chat nem hív checkout API-t, nem ad hozzá terméket a kosárhoz, nem redirectel pénztárhoz. A prompt szerint „finoman tereld a kosár és pénztár felé” – tehát szöveges irányítás van, technikai integráció (kosár API, checkout URL) nincs a kódbázisban.

---

## 11. Van-e email küldés rendelés után?

**Igen.**  
- **Rendelés megerősítés:** `src/lib/order-email.ts` – `sendOrderConfirmationEmail(order, customerEmail)`. A Stripe webhook (`src/app/api/stripe/webhook/route.ts`) a `checkout.session.completed` / paid esemény után meghívja. Ha van `RESEND_API_KEY`, a Resend API-n (`https://api.resend.com/emails`) küldi a HTML és plain text megerősítőt; ha nincs kulcs, csak log/warn.  
- **Egyéb:** `voice-email.ts` – callback kérés és call summary értesítés az adminnak (Resend), ha van `RESEND_API_KEY` és `ADMIN_EMAIL`.

---

## 12. Van-e email szolgáltató integráció?

**Igen – Resend.**  
- **Rendelés:** `order-email.ts` – fetch a `https://api.resend.com/emails` felé, `Authorization: Bearer RESEND_API_KEY`, `from`: `EMAIL_FROM` vagy `Gulumen <onboarding@resend.dev>`.  
- **Callback / call summary:** `voice-email.ts` – ugyanaz a Resend API.  
- **Newsletter:** `src/app/api/newsletter/route.ts` – szintén Resend (`RESEND_API`, `RESEND_FROM`).  
SendGrid, Nodemailer vagy más provider **nem található** a kódbázisban.

---

## 13. Van-e készletkezelés (stock tracking)?

**Részlegesen.**  
- **Készlet forrása:** a termékek a `src/lib/data.ts`-ben vannak (mockProducts), minden terméknek van `stock: number` mezője. A készlet **nem** adatbázisból jön, hanem statikus adat.  
- **Használat:** `getStockById(productId)`, `getMaxQty(product)` – kosár limit és „max hány darab adható a kosárba”. A **kosár nem foglal készletet** (kommentek: „A kosár NEM csökkenti a készlet kijelzést”).  
- **Sourcing deal:** a „készlet” a `maxOrders - ordersCount` (DB vagy JSON ordersCount), nem a `stock` mező.  
- **Nincs** valós idejű raktárkészlet-nyilvántartás, beszállítói integráció vagy automatikus készletlevonás a rendelés/fulfillment alapján – ez **nem található a kódbázisban**.

---

## 14. Van-e kupon vagy kedvezmény rendszer?

**Igen.**  
- **5% macska kupon:** `CatCouponContext` – localStorage (emailhez kötve), egyszer aktiválható; a kosárban és a pénztáron `isDiscountActive`, `discountPercent`; checkout/Stripe create-checkout-session kapja a `discountPercent`-ot, backend számolja a `discountHuf`-ot. Opcionálisan Stripe kupon: `STRIPE_COUPON_ID_5PERCENT`.  
- **Hűségkedvezmény:** `src/lib/loyalty.ts` – emailhez kötött, minősített vásárlásszám alapján (pl. 50k Ft feletti rendelések után +1% / rendelés, max 8%); a checkout és a fizetés oldal használja, nem összevonható a 5% kuponnal.  
- **Termék akció:** `discountPriceHuf` / `discountPriceEur` a termékeken; akciós szűrés, szortírozás a terméklistán.  
- **Regisztrációs 10% kupon:** a fordításokban (hu/en) szerepel szövegben; a konkrét 10% kupon alkalmazása a checkout-on **nem található** a kódbázisban (csak a 5% és a hűség százalék).

---

## 15. Van-e rendelés státusz kezelés?

**Igen.**  
- **Státuszok:** `OrderStatus` a `src/lib/orders.ts`-ben: `payment_pending`, `sourcing_pending`, `paid`, `cancelled`, `sourcing_failed`, `fulfilled`.  
- **Frissítés:** `setOrderStatus(orderId, status)` – Prisma (DB) vagy JSON store; a Stripe és a payments webhook, valamint az admin sourcing success/fail API hívja.  
- **Siker oldal:** `fizetes/siker/page.tsx` – a session_id / order_group_id alapján lekéri a rendeléseket és a státuszt (paid, fulfilled, cancelled, sourcing_failed) jeleníti meg.  
- **Admin:** sourcing rendelésnél `POST .../success` → fulfilled, `.../fail` → sourcing_failed (API-n keresztül, nincs admin UI lista).

---

## 16. Van-e felhasználói profil oldal?

**Igen, egyszerű.**  
- **Útvonal:** `src/app/profil/page.tsx`.  
- **Tartalom:** bejelentkezés után: „Bejelentkezve: {userId}” (valójában email jelenik meg) és Kijelentkezés gomb. Nincs jelszóváltás, profil szerkesztés, címek vagy rendeléslista ezen az oldalon.  
- **Nincs bejelentkezve:** login űrlap (email, jelszó) és link a regisztrációra.

---

## 17. Van-e rendelés előzmény oldal a felhasználóknak?

**Nem található a kódbázisban.**  
Nincs olyan oldal vagy API, amely a bejelentkezett userhez (userId) kötött rendeléseket listázna. A `Order` modellnek van opcionális `userId` mezője, de nincs `GET /api/me/orders` vagy „Rendeléseim” oldal. A sikeres fizetés után a rendelések a `session_id` / `order_group_id` alapján jelennek meg a siker oldalon (egyszeri megtekintés), nem „profil → rendelés előzmény” formában.

---

## 18. Van-e admin felület a rendelések kezelésére?

**Nem.**  
Az admin csak a **hívások / visszahívás kérések** kezelésére szolgál (`/admin/dashboard/calls`): mai hívások listája, pending callback kérések, Done/Cancelled, megjegyzés. A rendelések listázása, státusz módosítása (pl. paid → fulfilled) vagy szűrés **nem található** az admin UI-ban. A sourcing success/fail csak API (`/api/admin/sourcing/:orderId/success|fail`, `x-admin-key`), nincs admin táblázat a rendelésekkel.

---

## 19. Van-e termék admin felület?

**Nem található a kódbázisban.**  
A termékek a `src/lib/data.ts` mockProducts tömbjéből és a kategóriákból jönnek. Nincs admin oldal termék hozzáadására, szerkesztésére, törlésére vagy kép feltöltésére. A docs (`docs/3D_GLB_CHECKLIST_VALASZOK.md`) is említi: „Jelenleg nincs admin feltöltés; a modelUrl fix a mock adatban.”

---

## 20. Van-e statisztikai dashboard?

**Részlegesen – csak hívások.**  
Az admin dashboard (`/admin/dashboard/calls`) statisztikát mutat: **mai hívások száma**, **visszahívás függőben**, **top címkék** (utóbbi 100 hívás). Nincs árbevétel, rendelésszám, konverzió, látogatottság vagy termék statisztika a kódbázisban.

---

## 21. Van-e hiba log rendszer?

**Igen.**  
- **Pino logger:** `src/lib/logger.ts` – strukturált log (pino), dev-ban pino-pretty, szint: `LOG_LEVEL` vagy dev: debug, prod: info.  
- **Használat:** több API és lib (pl. stripe webhook, admin sourcing, order-email, voice-email, login rate limit) `logger.info` / `logger.warn` / `logger.error` / `logger.debug` hívásokkal logol.  
- **Sentry:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` – ha `SENTRY_DSN` be van állítva, a kliens és a szerver exception-ök és trace-ek (mintavételezve) a Sentry-be mennek. Tehát van **hiba/exception monitoring** és **strukturált app log** (fájl/stdout), de dedikált „log aggregáció” (pl. Datadog, Logtail) konfig **nem található** a repóban.

---

## 22. Van-e rate limit vagy bot védelem?

**Igen.**  
- **Általános rate limit:** `src/lib/rate-limit.ts` – IP alapú (x-forwarded-for / x-real-ip), 60 kérés / perc / IP, in-memory Map; 429 ha túllépés. Használat: `/api/chat`, `/api/stripe/create-checkout-session`.  
- **Login rate limit:** `src/lib/login-rate-limit.ts` – 10 sikertelen próbálkozás / 10 perc / IP; sikeres login törli a számlálót. Használat: `POST /api/auth/login`.  
- **Cron védelem:** `GET /api/cron/data-retention` – `Authorization: Bearer CRON_SECRET`.  
- **Voice/callback:** `VOICE_AGENT_WEBHOOK_SECRET` a call-summary és ai-voice endpointoknál.  
- Dedikált bot/captcha (reCAPTCHA, hCaptcha, Turnstile) **nem található** a kódbázisban.

---

## 23. Van-e caching (Redis vagy más)?

**Nincs Redis.**  
- **Next.js ISR:** egyes oldalak `revalidate = 30` vagy `5` (termékoldal), `revalidate = 0` (beszerzesre-rendelheto, lejart-termekek) – ez a Next.js page/data cache.  
- **In-memory:**  
  - `rate-limit.ts` és `login-rate-limit.ts` – Map (komment: multi-instance esetén Redis/Vercel KV javasolt).  
  - `idempotency.ts` – checkout Idempotency-Key válasz cache (24 óra).  
  - `euro-rate.ts` – EUR árfolyam cache.  
  - `prisma.ts` – `checkDbConnectivity()` eredmény ~60 s cache.  
- **Redis, Vercel KV, Memcached** vagy más külső cache **nem található** a kódbázisban.

---

## 24. Van-e fájl feltöltés rendszer?

**Nem található a kódbázisban.**  
Nincs multipart upload, multer, FormData kezelés kép/fájl feltöltésre az alkalmazásban. A termék képek és modellek statikus útvonalak (pl. `/img/`, `/models/`), nem felhasználói feltöltésből származnak.

---

## 25. Van-e kép optimalizáció rendszer?

**Részlegesen – Next.js Image.**  
- **next.config.js:** `images.formats: ['image/avif', 'image/webp']`, `deviceSizes` megadva – a Next.js Image komponens ezeket használja.  
- A termékoldalak és listák valószínűleg `<Image>`-et használnak (a komponensekben látható), így automatikus formátum és méret optimalizálás van.  
- Külső képfeldolgozó (Sharp pipeline, Cloudinary, imgix) vagy saját resize/optimize API **nem található** a kódbázisban.

---

## 26. Van-e többnyelvű támogatás?

**Igen.**  
- **Nyelvek:** hu, en, de, ro (`src/i18n/locales.ts`).  
- **Fordítások:** `src/i18n/translations/{hu,en,de,ro}.json` + index; `getTranslations(locale)`, `t(dict, key)`.  
- **Kontextus:** `LocaleContext` – kiválasztott nyelv; a chat, űrlapok, címkék, SEO metadata használják.  
- **Terméknevek:** `getProductName(product, locale)` – name, nameEn, nameDe, nameRo; keresés is locale-szűrővel.

---

## 27. Van-e több webshop kezelésére alkalmas architektúra?

**Nem.**  
Egyetlen márka/bolt (Gulumen), egy terméklista (mockProducts), egy layout, egy domain. Nincs multi-tenant (pl. shopId, subdomain, külön config per shop), nincs white-label vagy „több bolt egy backend” séma a kódbázisban.

---

## 28. Tudna-e SaaS platformként működni?

**Nem a jelenlegi kóddal.**  
Nincs bérlő (tenant) modell, nincs regisztráció/bejelentkezés „shop tulajdonosként”, nincs felület ahol ügyfelek saját webshopot indítanának, számlázás/előfizetés vagy API limit per tenant. Egyetlen webshop alkalmazás, nem több felhasználó (üzlet) kezelése SaaS formában.

---

## 29. Van-e API dokumentáció?

**Nem található a kódbázisban.**  
Nincs OpenAPI/Swagger spec, nincs külön API docs oldal vagy generált doc (pl. TypeDoc csak a kódra). A docs mappában markdown fájlok vannak (folyamatok, env, audit), de nem „nyilvános API referencia” formátumban.

---

## 30. Van-e teszt rendszer?

**Nem található a kódbázisban.**  
Nincs Jest, Vitest, Mocha, Cypress vagy Playwright konfiguráció a projektben (a package-lock.json dependency-ként előfordulnak más csomagok mellett, de a projektnek nincs test scriptje vagy `__tests__` mappa). A `package.json` scripts között nincs `test` vagy `test:integration`. A docs és a scripts mappa alatt vannak manuális teszt scriptek (pl. PowerShell: rate limit, sourcing race, IP forwarded).

---

## 31. Van-e monitoring rendszer?

**Igen – Sentry.**  
- Kliens és szerver: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `tracesSampleRate: 0.1`, environment.  
- Build: `withSentryConfig` a next.config-ben (org, project).  
- Nincs külön uptime / health dashboard vagy APM (pl. Datadog, New Relic) konfig a repóban; a platform (pl. Vercel) saját metrikáit nem látjuk a kódból.

---

## 32. Van-e backup stratégia az adatbázisra?

**Nem található a kódbázisban.**  
Nincs pg_dump script, snapshot, vagy backup folyamat a repóban. A docs (pl. TECHNIKAI_BIZTONSAGI_AUDIT.md) a backupot a platform/hosting felelősségére hivatkozza. Az adatbázis (PostgreSQL) backupja a szolgáltatótól (Neon, Railway, Supabase stb.) várható, nem az app kódjából indított.

---

## 33. Mely részek skálázódnának legnehezebben?

- **Rate limit / login rate limit:** in-memory Map – több instance esetén nem osztoznak az állapoton; a kommentek is Redis/KV-t javasolnak.  
- **Idempotency cache (checkout):** szintén in-memory – dupla kattintás védelem instance-on belül működik, több node-nál nem.  
- **Készlet / ordersCount:** a terméklista és a sourcing „készlet” egy része statikus (data.ts) + DB/JSON; nagy párhuzamos vásárlásnál a foglalás (ProductReservation) atomi, de a megjelenített „elérhető db” cache (revalidate 30/5) miatt lehet eltérés.  
- **DB kapcsolat:** Prisma, connection pool – nagy terhelésnél a pool limit és a serverless cold start számít; a docs Prisma Accelerate-ot említi skálázáshoz.  
- **Cron:** egyetlen cron (data-retention); ha több háttérfeladat kell, külső scheduler vagy queue kellene.

---

## 34. Mely részek a legerősebbek technikailag?

- **Auth:** httpOnly JWT cookie, jose, bcrypt, rate limit a loginon, session ellenőrzés szerveroldalon.  
- **Fizetés:** Stripe Checkout + webhook, idempotencia (checkout), rendelés státusz és loyalty összekötve.  
- **Sourcing:** atomi foglalás (ProductReservation), admin success/fail API, capture/cancel a fizetésnél.  
- **Biztonság:** middleware (CSP, HSTS, X-Frame-Options), admin cookie, CRON_SECRET, voice webhook secret.  
- **SEO:** metadata, sitemap, robots, JSON-LD.  
- **Többnyelv:** i18n 4 nyelv, terméknevek és keresés lokalizálva.  
- **Strukturált log (pino)** és **Sentry** integráció.

---

## 35. Ha ezt a rendszert egy startup fejlesztené, mennyi fejlesztési idő lenne becsülve?

Ez becslés, nem a kódbázisból származó adat.  
A jelenlegi funkciók (webshop, kosár, Stripe, sourcing, időzített akciók, auth, admin hívások, AI chat, email, többnyelv, cron, rate limit, Sentry, SEO) egy **kis–közép méretű full-stack projekt**. Egy tapasztalt 1 fős fejlesztővel **3–6 hónap**, 2–3 fővel **2–4 hónap** reális, attól függően, mennyi már megvolt (design, tartalom, Stripe/Resend fiók). A termékadatok kódban (data.ts), az admin csak hívásokra, és a teszt/CI hiánya növeli a karbantarthatóság és a továbbfejlesztés becsült idejét.

---

## Összefoglaló: erősségek és gyengeségek

### Erősségek
- **Full-stack egység:** Next.js 14, TypeScript, egy repó, világos struktúra.  
- **Fizetés és rendelés:** Stripe, webhook, idempotencia, státuszok, sourcing capture/cancel, loyalty.  
- **Biztonság és limit:** rate limit, login brute-force védelem, httpOnly session, middleware headerek, cron és voice secret.  
- **SEO és analytics:** metadata, sitemap, robots, JSON-LD; GA4 + Plausible kész.  
- **Többnyelv:** 4 nyelv, lokalizált termék és UI.  
- **Operatív:** Sentry, pino logger, Resend email (rendelés, callback, call summary).  
- **UX:** keresés, kosár, kedvencek, 5% kupon, hűségkedvezmény, AI chat (OpenAI + fallback).

### Gyengeségek / hiányok
- **Nincs CI/CD és teszt** – a repóban nincs automatikus teszt vagy pipeline.  
- **Nincs rendelés- és termék-admin** – rendelések listája, státusz módosítás, termék CRUD csak kódból (data.ts) vagy API-n (sourcing), nincs UI.  
- **Nincs „Rendeléseim” oldal** – userhez kötött rendeléslista hiányzik.  
- **Chatbot nem kap termékadatot** – ajánlás csak szöveges, nem konkrét termék link/ár.  
- **Készlet statikus** – nincs valós raktárkészlet-nyilvántartás vagy automatikus levonás.  
- **Rate limit és idempotency in-memory** – több instance esetén Redis/KV kellene.  
- **Nincs API docs és nincs backup stratégia** a repóban.  
- **Egy webshop, nem multi-tenant / SaaS** – több bolt kezelése nem támogatott.

---

*A dokumentum a jelenlegi kódbázis alapján készült. A „nem található a kódbázisban” mindig azt jelenti, hogy a keresés és a fájlok alapján ilyen implementáció nem szerepel a projektben.*
