# Hívj minket – Gulumen 0–24 AI telefonos asszisztens integráció

## Elkészült (weboldal)

### 1. "Hívj minket" gomb és felület

- **Header:** "Hívj minket" gomb – mobilon közvetlen `tel:` link (1 kattintás), desktopon modal nyitása.
- **Segítség menü:** Ugyanaz a "Hívj minket" link / gomb a dropdown-ban is.
- **Sticky CTA (mobil):** Jobb alsó sarokban fix telefon gomb (`tel:`), csak mobilon (`md:hidden`).
- **Footer:** "Hívj minket" gomb + linkek (Kapcsolat, Szállítás, Visszaküldés, Telefonos adatkezelés).

### 2. Desktop modal (CallUsModal)

- **Telefonszám** + **QR kód** (mobilról egy kattintással hívás).
- **"Kérj visszahívást"** fül: Név *, Telefonszám *, Téma, Preferált idő. Küldés → `POST /api/callback-request`.
- Rövid szöveg a rögzítésről + link a **Telefonos adatkezelés** szekcióra (`/kapcsolat#telefonos-adatkezeles`).

### 3. Adatkezelési tájékoztató (telefon)

- **Szekció:** "Telefonos ügyfélszolgálat – rögzítés és átirat" a **Kapcsolat** oldalon (`/kapcsolat#telefonos-adatkezeles`).
- Tartalom (HU/EN/DE/RO): miért készül átirat/rögzítés, meddig tároljuk, ki fér hozzá, hogyan kérhet törlést, elérhetőség (e-mail: info@gulumen.hu).

### 4. API

- **POST /api/callback-request**  
  Body: `{ name, phone, topic?, preferredTime? }`.  
  Rate limit: 60/perc/IP.  
  Opcionális: **CALLBACK_WEBHOOK_URL** (Make/backend) – a payload továbbítása.

### 5. Környezeti változók

- **NEXT_PUBLIC_SUPPORT_PHONE** – Ügyfélszolgálati szám (pl. `+36301234567`). Ha nincs: placeholder `+36301234567`.
- **CALLBACK_WEBHOOK_URL** – Visszahívás kérések továbbítása (pl. Make scenario). Payload: `name`, `phone`, `topic`, `preferredTime`, `createdAt` (ISO string).

Részletek: `docs/ENV.md`.

---

## Nincs még a kódban (telefonos rendszer, voice agent)

Ezeket külső szolgáltatásokkal kell megoldani; a weboldal készen van a hívásküldésre és a visszahívás kérés fogadására.

### Telefonszám + VoIP

- Magyar +36 (vagy EU) szám: Twilio / más SIP provider.
- Bejövő hívás irányítása a voice agent felé.

### Voice agent platform

- Pl. **Vapi**, **Retell**, **Twilio Voice** – STT, TTS, webhook “call ended” + transcript/meta.

### Call flow (platform konfig / script)

- Nyelvválasztás (HU/EN) → Consent (rögzítés/átirat) → B2C/B2B routing → Visszahívás kérés adatgyűjtés.
- Spec részletesen a feladatleírásban (3.1–3.3, 4, 5).

### Call ended webhook → Make / backend

- Minimum payload: `call_id`, `timestamp`, `language`, `mode`, `caller_number`, `consent`, `transcript` (ha consent=yes), `summary`, `tags`.
- Make: mentés CRM-be, Telegram + e-mail értesítés, visszahívás feladat létrehozása.

---

## Készre jelentés (Done) – weboldal szempontjából

- [x] "Hívj minket" gomb headerben, mobilon sticky CTA, footerben.
- [x] Mobil: `tel:` (1 kattintás). Desktop: modal (telefonszám + QR + "Kérj visszahívást" űrlap).
- [x] Adatkezelési szekció: telefonos rögzítés/átirat a Kapcsolat oldalon.
- [x] Visszahívás kérés űrlap → API → opcionális webhook.

A tényleges 0–24 AI hívásfolyam a Twilio/Vapi/Retell és a Make (vagy saját backend) beállításától függ.
