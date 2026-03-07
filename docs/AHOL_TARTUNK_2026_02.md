# Ahol tartunk – 2026. február (rövid állapot)

Rövid összefoglaló a legutóbbi webshop/UI fejlesztésekről.

---

## 3D nyomtatott termékek (szín + anyag)

- **Termékoldal:** Színezhető 3D terméknél kötelező választani **anyagot** (PLA vagy PETG) és **színt** a kosárba tétel előtt. Nincs alapértelmezett szín vagy anyag (megtévesztés elkerülésére).
- **Anyagválasztó** a színválasztó **felett** jelenik meg. Gombok: PLA, PETG.
- **Anyaginfó** (összecsukható): rövid tulajdonságleírás – csak anyagtulajdonság, strapabíróság, használati hely; **nincs nyomtatóval kapcsolatos megfogalmazás**.
  - **PLA:** Biobázisú. Belső és kerti használatra ideális. Kevésbé hőálló, kevésbé ütésálló.
  - **PETG:** Erősebb, rugalmasabb, jobban ellenáll a hőnek és az ütésnek. Konyha, tartós használat.
- **Kosár / fizetés:** A sorok anyag és szín szerint különülnek; a kosárban és a fizetés oldalon megjelenik pl. „Anyag: PETG · Szín: Zöld”.
- **Figyelmeztető szöveg** (ha hiányzik szín vagy anyag): *„Válaszd ki a színt és az anyagot (PLA/PETG) a kosárba tétel előtt.”*

**Érintett fájlok (említésre érdemes):**  
`ProductPageContent.tsx`, `CartContext.tsx`, `CartDrawer.tsx`, `kosar/page.tsx`, `fizetes/page.tsx`, `api/checkout/route.ts`, i18n (hu, en, de, ro).

---

## Hívj minket / visszahívás kérése

- **„Kérj visszahívást”** fülön a preferált idő megadása:
  - **Azonnali (5–10 percen belül)** – alapból kiválasztva.
  - **Később:** naptár (dátum, minimum ma) + óraválasztó (8–18 óra).
- A beküldött érték: azonnalinál pl. *„Azonnali (5–10 percen belül)”*, későbbinál pl. *„2026.02.21. 14:00”* (dátum + óra).

**Érintett:** `CallUsModal.tsx`, i18n (callUs.callbackOptionImmediate, callbackOptionLater, callbackDate, callbackHour).

---

## Fordítások (i18n)

- Új/ módosított kulcsok: `product.material`, `product.materialInfoTitle`, `product.materialPla`, `product.materialPetg`, `product.selectColorToAdd`, `product.selectMaterialAndColorToAdd`; callUs: `callbackOptionImmediate`, `callbackOptionLater`, `callbackDate`, `callbackHour`.
- Nyelvek: hu, en, de, ro.

---

## Következő lépések (opcionális)

- Stripe valós bekötés (ha kell).
- Teszt: 3D termék kosárba (PLA + szín, PETG + szín), visszahívás (azonnali + később dátum/óra).
- További 3D termékek / anyagok (pl. több filament) bővítése szükség esetén.

*Utolsó frissítés: 2026. február.*
