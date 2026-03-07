# A Gulumen veboldal állapota – körülbelül 150 mondat

Pontos leírás arról, hol tart most a veboldal: mit tud, milyen lehetőségek vannak benne, és hogyan működnek a fő funkciók.

---

## Általános és technika

1. A Gulumen egy Next.js 14 alapú webshop, gondosan válogatott, limitált minőségi termékekkel.
2. A metaadatok és a nyitólap szövege a „limitált darabszámú minőségi termékek” és a táskák, ruházat, kiegészítők kedvező áron való kiemelésére épülnek.
3. A frontend React (client components), a stílusok Tailwind CSS-sel és CSS változókkal (téma, sötét/világos mód) készültek.
4. A nyelvek: magyar (hu), angol (en), német (de), román (ro); a fordítások a `src/i18n/translations` mappában, JSON fájlokban vannak.
5. A layout-ban LocaleProvider, AuthProvider, CartProvider, WishlistProvider, ToastProvider, EuroRateProvider, CatCouponProvider, SourcingDealOrdersProvider biztosítják a globális állapotot.
6. A Header-ben a navigáció (Termékek, Akciók, Újdonságok, Beszerzésre rendelhető, Segítség & Információk), nyelvválasztó, kedvencek, keresés, kosár és profil ikonok látszanak.
7. A Footer-ben linkek (szállítás, returnok, kapcsolat, adatkezelés), valamint a „Hívj minket” és az AI chat gombok.
8. Mobilon egy sticky „Hívj minket” CTA van a jobb alsó sarokban (CallUsStickyCTA).
9. Az Analytics komponens a NEXT_PUBLIC_GA_MEASUREMENT_ID alapján GA4-et tud használni; opcionálisan más analytics is beilleszthető.
10. A Sentry (client, server, edge config) opcionálisan be van kötve hibajelentésre.

---

## Oldalak és menü

11. A nyitólap (home) hero szekcióval, regisztrációs CTA-val, újdonságok és akciós termékek blokkokkal, valamint utoljára megtekintett termékekkel és newsletter feliratkozással indul.
12. A Termékek menüpont a `/termekek` oldalra visz, ahol kategóriák és szűrés (új, akció, beszerzésre rendelhető) alapján böngészhetők a termékek.
13. A kategóriák: Táskák, Ruházat, Kiegészítők, Elektronika / Egyéb, Otthon, 3D Nyomtatott Termékek.
14. A 3D Nyomtatott alatt fülek vannak: Konyha, Játék, Kert, Lakásdekor, Eszközök, Kreatív, Ajándék.
15. Az Újdonságok oldal csak az újdonságként jelölt termékeket listázza; az Akciók oldal az akciós termékeket.
16. A Beszerzésre rendelhető oldal csak az időzített beszerzésre rendelhető (sourcing deal) ajánlatokat mutatja, előnézet és vásárlási időszak szerint.
17. A Lejárt termékek oldal a már lejárt sourcing ajánlatokat jeleníti meg (archiválásra váró).
18. A termék részletes oldal a `/termek/[slug]` útvonalon van: képgaléria, 360° és 3D megtekintés (ahol van), szín- és anyagválasztó (3D-nél), kosárba tétel, leírás, szállítás és visszaküldés fülek.
19. A Kosár oldal (`/kosar`) a kosár tartalmát, mennyiségeket, kupont, kedvezményt és a „Tovább a fizetéshez” folyamatot kezeli.
20. A Fizetés oldal (`/fizetes`) a rendelés összefoglalóját, e-mail megadását (vendég vagy bejelentkezett), kupon és lojalitás kedvezményt, valamint a kártyás fizetés indítását.

---

## Fizetés és rendelés

21. A checkout API (`/api/checkout`) POST-ként fogadja a kosár tételeit, vásárlói e-mailt és opcionálisan kupon/lojalitás adatokat.
22. A checkout idempotencia kulcsot kezel (Idempotency-Key header), hogy dupla kattintás ne eredményezzen dupla rendelést.
23. A rendelések típus szerint szétválnak: készleten lévő (stock) és beszerzésre rendelhető (sourcing); a fizetési folyamat ennek megfelelően külön session-öket vagy lépéseket indíthat.
24. A Stripe Checkout session a `/api/stripe/create-checkout-session`-ön keresztül jön létre, ha a Stripe konfigurálva van (STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
25. Ha a Stripe nincs beállítva, a rendszer DummyProvider-t használ: a fizetés mock módban fut, valódi kártyaadó nem kerül bekötésre.
26. A Stripe webhook (`/api/stripe/webhook`) a checkout.session.completed és payment_intent.succeeded eseményeket kezeli, és frissíti a rendelés és tranzakció státuszát.
27. A fizetés siker oldal (`/fizetes/siker`) a session vagy order_group_id alapján mutatja a sikeres vásárlást; a megszakított fizetés a `/fizetes/megszakitva` oldalon jelenik meg.
28. A rendelések tárolása: Prisma + adatbázis, fallback-ként JSON fájl (data/orders.json) is használható a fejlesztéshez.
29. A kosár nem foglal készletet; a termék készlet csak a termék adatbázisban/source-ban van, a kosár csak productId, qty és opcionális options (szín, anyag) alapján működik.

---

## Kosár és termék opciók

30. A kosár a localStorage-ban tárolódik (gulumen-cart kulcs), és a CartContext kezeli.
31. Egy kosár sor egyértelműen productId + options (colorName, colorHex, materialName) alapján azonosított; ugyanaz a termék más színnel vagy anyaggal külön sor.
32. A 3D színezhető termékeknél a kosárba a kiválasztott szín és anyag (PLA vagy PETG) kerül; ezek a termékoldalon kötelezően választhatók a kosárba tétel előtt.
33. A mennyiség módosítás és törlés a kosár oldalon és a CartDrawer-ban (felugró kosár) is elérhető.
34. A készleten lévő termékeknél a maximális kosárba tehető mennyiség a készlet és a már a kosárban lévő mennyiség alapján számolódik; a 3D termékeknél gyakorlatilag nincs limit („bármennyi darab”).
35. A beszerzésre rendelhető termékeknél a maximális rendelhető darab a maxOrders és az ordersCount (már leadott rendelések) különbsége.

---

## 3D nyomtatott termékek

36. A 3D termékek a kategória 3d- prefixe alapján ismerhetők fel (pl. 3d-kert, 3d-konyha).
37. A termékoldalon a színezhető 3D termékeknél először az anyag (PLA vagy PETG) választó jelenik meg a színválasztó felett.
38. Az anyagleírás összecsukható blokkban van: PLA (biobázisú, belső/kerti, kevésbé hő- és ütésálló), PETG (erősebb, rugalmasabb, hő- és ütésálló, konyha, tartós használat); nincs nyomtatóval kapcsolatos szöveg.
39. A színválasztó a filament színekből (fehér, fekete, piros, kék, zöld, szürke, sárga, arany, barna, fámintázat, kömintázat, neon színek) választ.
40. Nincs alapértelmezett szín vagy anyag; a „Kosárba” gomb csak akkor aktív, ha mindkettő ki van választva.
41. A figyelmeztető szöveg: „Válaszd ki a színt és az anyagot (PLA/PETG) a kosárba tétel előtt.”
42. Ha van GLB modell (modelUrl), a termékoldalon a „Forgasd körbe (3D)” gombbal 3D nézet nyitható, ahol a kiválasztott szín színezheti a modellt.
43. A 3D termékek listán és kártyán „3D Nyomtatott” badge jelenik meg.

---

## Beszerzésre rendelhető (sourcing deal)

44. A sourcing deal termékeknek van previewFrom, saleFrom, saleTo és maxOrders mezőjük; a státusz: preview (előnézet), sale (vehető), soldout (elfogyott), closed (lejárt).
45. Az előnézetben a termék megtekinthető, de kosárba tétel még nem engedélyezett; a vásárlási ablakban a számláló és a „Vásárlás indul” / „Most rendelhető” szövegek jelennek meg.
46. A checkout és a készlet/sourcing logika a szerver aktuális időpontja és a friss ordersCount alapján dönti el, hogy az ajánlat még vehető-e.
47. A lejárt ajánlatok a Beszerzésre rendelhető listáról kikerülnek és a Lejárt termékek oldalon jelennek meg.
48. A sourcing tételek a kosárban és a fizetésnél külön blokkban látszanak („Produse la comandă” / beszerzésre rendelhető), a szállítási idő 7–14 nap.

---

## Regisztráció, bejelentkezés, profil

49. A regisztráció a `/regisztracio` oldalon történik: e-mail, jelszó, opcionálisan hírlevél feliratkozás (10% kupon egy alkalommal).
50. A regisztrációt a `/api/auth/register` API kezeli; a jelszó hashelés bcrypttel történik.
51. A bejelentkezés a `/profil` oldalon vagy a header profil ikonján keresztül elérhető; a `/api/auth/login` e-mail és jelszó alapján session-t ad.
52. A session a `/api/auth/session` végponton lekérdezhető; a kliens az AuthContext-ben tárolja a bejelentkezési állapotot és a userId-t (e-mail).
53. A kijelentkezés a `/api/auth/logout`-on keresztül invalidálja a session-t.

---

## Kedvencek és kedvelések

54. A kedvencek (wishlist) a bejelentkezett felhasználóhoz kötöttek; a `/api/me/wishlist` és a termék like API (`/api/products/[id]/like`) használatával szinkronizálódnak.
55. A termékoldalon és a termékkártyákon szív ikonnal lehet kedvencnek jelölni a terméket; a kedvelések száma (likesCount) megjelenik (FOMO).
56. A Kedvencek oldal (`/kedvencek`) a bejelentkezett felhasználó kedvenc termékeit listázza; bejelentkezés nélkül a rendszer figyelmeztet.

---

## Kupon és lojalitás

57. A macska kupon (5% kedvezmény) a CatCouponContext-ben van kezelve; aktiválás bejelentkezés után a regisztrációs / profil flow részeként.
58. A fizetés oldalon a kupon aktív állapotában a subtotal és a kedvezmény külön látszik; a checkout body-ban isDiscountActive és discountPercent megy.
59. A lojalitási kedvezmény a `/api/loyalty` alapján számolódik: e-mail szerint a minősült fizetett rendelések után növekvő százalék (pl. max 8%); a fizetés oldalon a bejelentkezett user e-mailjével lekérdeződik.
60. A kupon és a lojalitás kedvezmény egyszerre nem alkalmazható (a szövegek is ezt tükrözik).

---

## Hívj minket és visszahívás

61. A „Hívj minket” modal két fülből áll: Telefonszám (közvetlen hívás, QR kód) és Kérj visszahívást.
62. A visszahívás kérésnél kötelező a név és a telefonszám; opcionális a téma és a preferált idő.
63. A preferált idő két opció: „Azonnali (5–10 percen belül)” vagy „Később”, utóbbinál dátumválasztó (naptár, minimum ma) és óraválasztó (8–18 óra).
64. A beküldött kérés a `/api/callback-request`-re megy; a backend menti az adatbázisba (CallbackRequest), e-mailt küld (Resend) és opcionálisan webhookot hív; Telegram értesítés is konfigurálható.
65. Az admin felületen a függő visszahívás kérések kezelhetők (admin dashboard calls).

---

## AI asszisztens és chat

66. Az AI asszisztens egy lebegő „Kérdésed van? Segítek!” gombbal nyitható chat ablak.
67. A chat a `/api/chat` POST-tal küld üzenetet; a válasz a locale szerint lokalizált szöveget ad (termékek, szállítás, returnok, plată, regisztráció stb.).
68. Ha az API nem elérhető, kliens oldali fallback válaszok (ai.* fordítási kulcsok) jelennek meg.
69. A chat-ban lehetőség van ügyintézőhöz történő „eszkalációra” (pl. handover üzenet); a Hívj minket modal a chat-ból is megnyitható.

---

## Admin

70. Az admin belépés külön útvonalon van (`/admin/login`); a session cookie vagy JWT alapján védett.
71. Az admin dashboard calls oldal (`/admin/dashboard/calls`) a mai hívásokat, a függő visszahívás kéréseket és a legutóbbi hívásokat listázza; a CallbackRequest státuszát (pending, delivered stb.) lehet frissíteni.
72. A beszerzésre rendelhető ajánlatok admin sikeres/sikertelen jelölése a `/api/admin/sourcing/[orderId]/success` és `/fail` végpontokon keresztül történik.

---

## Newsletter és egyéb

73. A newsletter feliratkozás a nyitólap és egyéb CTA-kon keresztül elérhető; a `/api/newsletter` kezeli a feliratkozást (pl. dupla opt-in linkkel).
74. A szállítás és a visszaküldés információs oldalak (`/szallitas`, `/visszakuldes`) a tartalommal és a fordításokkal rendelkeznek.
75. A Kapcsolat oldal (`/kapcsolat`) elérhetőségeket és a telefonos adatkezelési tájékoztatót tartalmazza.
76. A keresés a header-ben a termékek oldalra navigál (keresés a listán belül vagy későbbi bővítéssel).

---

## Termékadatok és készlet

77. A termékek jelenleg mock adatbázisból jönnek (`mockProducts` a `src/lib/data.ts`-ben); a termékeknek van id, name (többnyelv), slug, priceHuf, priceEur, condition, category, image, images, stock, description, type (stock | sourcing_deal).
78. A 3D termékeknek lehet modelUrl (GLB), isColorable; a sourcing deal termékeknek previewFrom, saleFrom, saleTo, maxOrders, ordersCount.
79. A készlet a getStockById(productId) alapján adódik; a sourcing deal esetén a „elérhető” a maxOrders − ordersCount.
80. A termék ordersCount a rendelésekből (OrderItem) aggregálódik; az API-ban a getProductOrdersCounts és getProductOrdersCount használatos.
81. A termékoldalon a „Utoljára megtekintett” és a „Hasonló termékek” blokkok a mockProducts és a kategória alapján jönnek létre.

---

## Fizetési és rendelés folyamat részletei

82. A fizetés oldalon a vendég vásárló e-mail címet kötelezően megadja; a bejelentkezett user e-mailje automatikusan használatos.
83. A checkout API validálja a tételeket (termék létezik, készlet/sourcing limit), kiszámolja a subtotal, discount és total összegeket, és létrehozza a rendeléseket (in_stock és sourcing külön).
84. A Stripe esetén a create-checkout-session line_items-ként a termékeket és az árakat adja meg; a success_url és cancel_url a fizetés siker/megszakítás oldalra mutat.
85. A payments webhook általános interfészt használ (PaymentProvider); a Stripe webhook a checkout.session.completed-nál frissíti a PaymentTransaction és az Order státuszát (paid).
86. A rendelés státuszok (pl. pending, paid, refunded) az Order modellben és a PaymentTransaction táblában vannak tárolva.

---

## Biztonság és egyéb technika

87. A middleware biztonsági headereket ad (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, CSP).
88. A login és érzékeny API-k rate limitálva lehetnek (pl. rate-limit könyvtár vagy egyéni logika).
89. A Prisma sémában User, Order, OrderItem, PaymentTransaction, ProductLike, LoyaltyRecord, AdminAction, CallbackRequest, Call és kapcsolódó modellek szerepelnek.
90. A cron/data-retention API (pl. `/api/cron/data-retention`) a régi CallbackRequest és Call adatok törlésére, illetve transcript megtartási időre használható.
91. A voice/call összefoglaló (`/api/call-summary`) a hívás befejezésekor küldhet összefoglalót; a callback_required tag esetén automatikusan létrehozható CallbackRequest.
92. Az AI voice route (`/api/ai-voice`) a telefonos AI asszisztens válaszaihoz kapcsolódik (ha van ilyen integráció).

---

## Összefoglalva

93. A veboldal teljes értékű webshop: böngészés, kosár, checkout, fizetés (Stripe vagy dummy), regisztráció, bejelentkezés, kedvencek, kupon, lojalitás.
94. Különleges funkciók: 3D termékek szín és anyag (PLA/PETG) választással, időzített beszerzésre rendelhető ajánlatok, visszahívás kérés naptárral és azonnali opcióval, AI chat és Hívj minket modal.
95. Többnyelvű (hu, en, de, ro), reszponzív, sötét/világos téma, és az admin felület a hívások és visszahívás kérések kezelésére.
96. A valódi fizetés a Stripe konfigurációtól függ; enélkül a DummyProviderrel a rendelés és a fizetés flow tesztelhető.
97. A dokumentum körülbelül 150 mondatban foglalja össze a jelenlegi állapotot; a további részletek a forráskódban és a docs mappában találhatók.
98. A termékoldalon a lightbox a termék képeinek nagyítását, a 360° nézet a forgatható képkockákat biztosítja.
99. A breadcrumb a Termékek / kategória / terméknév formátumban jelenik meg.
100. A ProductJsonLd és OrganizationJsonLd strukturált adatokkal segítik a keresők megjelenítését.
101. A kosár oldalon a „Tovább a fizetéshez” gomb a sourcing tételeknél a CheckoutSourcingModal-t nyitja, ahol a beszerzésre rendelhető feltételek elfogadása szükséges.
102. A fizetés oldalon a kártyás fizetés gomb a checkout API hívása után a Stripe redirect URL-re vagy a DummyProvider által visszaadott sikeres eredményre visz.
103. A Stripe HUF zero-decimal: az összegek forintban egész számok, nem fillérben.
104. A rendelés csoport (orderGroupId) összeköti a készleten lévő és a sourcing rendeléseket, ha egy fizetésben mindkettő szerepel.
105. A rendelések lekérdezése by-session (Stripe session_id) és by-group (orderGroupId) API-kon keresztül történik.
106. A fizetés sikeres oldal az order_group_id vagy a session alapján tölti be a rendelés adatokat és a fizetett összeget.
107. A WalletErrorGuard komponens a böngésző pénztárca hibákat (pl. Stripe) kezeli és felhasználóbarát üzenetet mutat.
108. A DealPopup egy felugró ajánlat ablak lehet a nyitólap vagy egyéb oldalakon.
109. A RecentlyViewed a localStorage-ban tárolt utoljára megtekintett termékeket jeleníti meg a nyitólapon.
110. A termékek listán a rendezés: legújabb, ár növekvő, ár csökkenő; a szűrés kategória, állapot és méret szerint is lehetséges (ahol van ilyen adat).
111. A 3D oldalon a termékek csak a 3d- prefixű kategóriájúak; a többi kategória oldalon a 3D termékek kiszűrődnek.
112. A ProductCard-on a sourcing deal termékeknél visszaszámláló (SourcingDealCardCountdown) és státusz badge (előnézet, most rendelhető, elfogyott, lejárt) jelenik meg.
113. A SoldImpactOverlay a lejárt vagy elfogyott termékeknél vizuális „lejárt” overlay-t ad.
114. A wishlist szinkronizálás a syncFromServer hívással történik, hogy a szerver és a kliens állapot egyezzen.
115. A like (kedvelés) POST csak bejelentkezett userrel működik; 401 esetén a felhasználónak be kell jelentkeznie.
116. A checkout body-ban a customer objektum email és opcionális name mezőket tartalmaz; a rendeléshez ez kötelező.
117. A loyalty százalék a LoyaltyRecord táblából vagy a megfelelő API-ból jön; a minősült rendelések száma és a százalék a dokumentációban vagy a loyalty modulban van definiálva.
118. A regisztrációs 10% kupon egyszer használható, és a hírlevél elfogadásához kötött lehet.
119. A CallUsModal-ban a QR kód a telefonszámra mutató linket generál, hogy mobilon egy kattintással hívni lehessen.
120. A visszahívás kérés preferredTime mezője szövegesen kerül az e-mailbe és a Telegram üzenetbe (azonnali vagy dátum + óra).
121. Az admin callback-request PATCH a státusz frissítésére szolgál (pl. pending → delivered).
122. A Prisma migrációk a schema változásokhoz (pl. CallbackRequest, Call, CallbackDelivery) a migrations mappában vannak.
123. A rate limit a callback-request és egyéb érzékeny végpontokon csökkenti a spam és az abuse kockázatát.
124. A termék oldalon a mennyiség választó 1 és maxAddable között választhat; a 3D termékeknél a maximum 99 darab lehet.
125. A kosárban a termék sor törlése a removeItem(productId, options) hívással történik; a mennyiség csökkentése 1-re állítja vagy törli a sort.
126. A CartDrawer a header kosár ikonjára kattintva nyílik; ugyanazok a tételek és opciók jelennek meg, mint a kosár oldalon.
127. A fizetés oldalon a tételek listája a kosár alapján készül; minden tételnél megjelenik a terméknév, mennyiség, opcionálisan szín és anyag.
128. A Stripe create-checkout-session a success_url és cancel_url mellett a customer_email-et is beállítja, ha vendég vásárlásról van szó.
129. A webhook események aláírás ellenőrzése (Stripe webhook secret) biztosítja, hogy csak a Stripe által küldött kérések legyenek feldolgozva.
130. A hibaüzenetek (pl. „Túl sok kérés”, „Érvényes e-mail szükséges”) a válaszban és a toast értesítéssel jelennek meg a kliensen.
131. A toast (ToastContext) a „Termék a kosárban” és a „Kosár megnyitása” action linkkel jelzi a sikeres kosárba tételt.
132. Az EuroRateContext a HUF és EUR közötti árfolyamot kezeli; az árak forintban és euróban is megjelennek (pl. „2490 Ft (€6,3)”).
133. A sötét mód a felhasználó preferenciájából vagy a rendszer témyból vált; a CSS változók (--background, --foreground, --card-bg, --border, --accent) a témát vezérlik.
134. A 3D modell viewer (ProductModelViewer) a selectedColorHex alapján színezheti a modellt a kiválasztott filament színre.
135. A filament színek a filamentColors.ts fájlban vannak definiálva, többnyelvű névvel (name, nameEn, nameDe, nameRo).
136. A getFilamentColorName(locale) a kiválasztott nyelv szerint adja vissza a szín nevét a kosárban és a termékoldalon.
137. A checkout API options-ban a colorName, colorHex és materialName is elfogadott; ezek a rendelés tétel szinten továbbíthatók (ahol az OrderItem vagy a rendelés logika ezt kezeli).
138. A BeszerzesreRendelhetoClient a termékeket kártyákon jeleníti meg, a szerverről kapott serverNow és ordersCount alapján.
139. A lejárt termékek oldal (LejartTermekekClient) a lejárt sourcing ajánlatokat „Hamarosan archiválásra kerül” szöveggel mutatja.
140. A termékek API (orders-count) a termék rendelési darabszámát adja vissza; ez a sourcing és a „X db rendelve” megjelenítéshez használható.
141. A middleware kizárja a statikus fájlokat (_next/static, _next/image, favicon) a biztonsági header alkalmazásából.
142. A robots.ts és sitemap.ts a NEXT_PUBLIC_APP_URL alapján generálja a keresőbarát URL-eket.
143. A regisztráció és a bejelentkezés űrlapok validációja kliens oldalon is történik (pl. e-mail formátum, jelszó kitöltés).
144. A jelszó nem kerül tárolásra nyersen; a regisztrációnál bcrypt hash készül, a login a hash ellenőrzésével történik.
145. A session cookie httpOnly és secure lehet éles környezetben; a pontos beállítás a auth konfigurációtól függ.
146. A veboldal így összességében kész a felhasználói böngészésre, kosárba tételre, regisztrációra, bejelentkezésre, kedvencek kezelésére, kupon és lojalitás használatára, időzített beszerzésre rendelhető vásárlásra, 3D termék szín és anyag választására, visszahívás kérésére és (konfigurációtól függően) Stripe kártyás fizetésre.
147. A fejlesztők a docs mappában található dokumentumokból (ENV, FOLYAMATOK, SOURCING_*, 3D_*, HIVJ_MINKET, stb.) tájékozódhatnak a környezetről és a folyamatokról.
148. A további lehetőségek: valós termékadatbázis (pl. CMS vagy admin termék CRUD), további fizetési módok, e-mail rendelésösszefoglaló, és a voice/AI integráció bővítése.
149. Ez a dokumentum körülbelül 150 mondatban rögzíti a Gulumen veboldal jelenlegi képességeit és állapotát.
150. Az utolsó frissítés időpontja: 2026. február.

*Utolsó frissítés: 2026. február.*
