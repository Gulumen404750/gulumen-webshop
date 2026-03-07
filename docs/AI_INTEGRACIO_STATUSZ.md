# 📊 Gulumen AI integráció – Projekt státusz

*Utolsó frissítés: 2025-02-20*

---

## 1️⃣ Webes AI chat – Jelenlegi állapot

### Működik-e az AI chat asszisztens?
**Igen.** A weboldalon van AI chat asszisztens, a layout-ban minden oldalon elérhető (jobb alsó „Segítség” gomb).

### Technológia
- **Backend:** Next.js API Route `POST /api/chat`
- **AI:** **OpenAI API** (Chat Completions) – model: `gpt-4o-mini`, fallback `gpt-4o`
- **Fallback:** Ha nincs `OPENAI_API_KEY` vagy a hívás sikertelen → rule-based válaszok (`src/lib/ai-assistant.ts`) + i18n fordítások (hu/en/de/ro)

### Saját API endpoint
- **Igen:** `POST /api/chat`  
  - Body: `{ message: string, locale?: string }`  
  - Response: `{ text: string, escalate?: boolean }`  
  - Rate limit van (60/perc/IP közelítés)

### Beszélgetések mentése
- **Nem.** A webes chat **nem ment** sehova.
  - Üzenetek csak a böngészőben, a komponens state-ben vannak (memória).
  - Nincs DB tábla a chat üzeneteknek, nincs transcript, nincs summary.

### Adatkezelési tájékoztató a chathez
- **Nincs** külön „chat adatkezelés” szekció.
- A Kapcsolat oldalon van **telefonos** adatkezelés (rögzítés/átirat); a **chat adatkezelés** nincs külön dokumentálva.

---

## 2️⃣ Telefonos AI – Jelenlegi státusz

### Lefoglalt telefonszám
- **A kódban:** `NEXT_PUBLIC_SUPPORT_PHONE` – ha nincs megadva, placeholder: `+36301234567`.
- **Tényleges szám:** A docs szerint ez még **nem** végleges („cseréld éles számra”). Tehát **nincs bizonyítottan lefoglalt, éles szám** a repóban.

### VoIP szolgáltató
- **Nincs kiválasztva a kódban.** A dokumentáció (HIVJ_MINKET_INTEGRACIO.md) említi: Twilio / más SIP provider – a **voice agent platform** köti a számot (pl. Vapi/Retell).

### Voice agent (Vapi / Retell / Twilio)
- **Nincs még kiválasztva / beállítva.** A docs: „Voice agent platform: pl. Vapi, Retell, Twilio Voice” – ezek **terv** szinten vannak.

### AI voice endpoint
- **Megvan.**  
  - **POST /api/ai-voice**  
  - Hitelesítés: `VOICE_AGENT_WEBHOOK_SECRET` (Bearer vagy `x-api-key`).  
  - Body: `conversation_id`, `language` (hu|en), `message`.  
  - Válasz: `{ reply: string }` – OpenAI `gpt-4o-mini` (max 2–3 mondat), vagy fallback szöveg ha nincs API kulcs.  
  - Rate limit van.

### Nyelvválasztás + consent logika
- **Backend készen van** a fogadásra:
  - `call-summary`: `language` (hu|en), `consent` (boolean). Ha `consent === false`, a **transcript nem kerül mentésre** (csak summary/tags stb.).
- A **nyelvválasztás és consent** a hívás során a **voice agent (Vapi/Retell stb.)** feladata – ezt a platformon kell konfigurálni (call flow: nyelv → consent → B2C/B2B). A weboldal ezt nem vezérli.

---

## 3️⃣ Backend integráció

| Elem | Státusz |
|------|--------|
| **POST /api/call-summary** | ✅ Van. Webhook: call_id, timestamp, language, mode, caller_number, consent, transcript, summary, tags. Auth: VOICE_AGENT_WEBHOOK_SECRET. |
| **POST /api/callback-request** | ✅ Van. Űrlap + opcionális CALLBACK_WEBHOOK_URL. |
| **DB: Call** | ✅ Van (Prisma + migráció). Mezők: callId, timestamp, language, mode, callerNumber, consent, summary, transcript (csak consent=true), tags. |
| **DB: CallbackRequest** | ✅ Van. name, phone, topic, preferredTime, status (pending/done/cancelled). |
| **DB: VoiceApiLog** | ✅ Van. endpoint, callId, consent, success, details – audit/rate limit. |
| **Webhook kezelés** | ✅ call-summary: teljes webhook (mentés DB, e-mail, Telegram, callback_required → CallbackRequest). callback-request: opcionális külső CALLBACK_WEBHOOK_URL. |

---

## 4️⃣ Adatkezelési modell

### Teljes beszélgetés (transcript)
- **Csak consent = true esetén** kerül mentésre (DB `Call.transcript` + opcionálisan e-mail).
- consent = false → transcript **nem** tárolódik (a call-summary kód explicit `transcriptToStore = null`).

### Summary
- **Mindig** mentésre kerül, ha a webhook küldi (`Call.summary`). Consent-től független.

### Tárolási idő – hol dokumentálva?
- **Felhasználónak:** A Kapcsolat oldalon, „Telefonos adatkezelés” szekció (i18n: `callUsDataProtection.storage`):  
  „Az átirat és a rögzítés a szükséges ideig, legfeljebb a jogi megtartási kötelezettségnek megfelelően tároljuk.”  
- **Konkrét nap/hónap** nincs megadva se a kódban, se a szövegben.

### Törlési mechanizmus
- **Automatikus törlés:** **Nincs.** Nincs cron, nincs scheduled job, ami régi Call/transcript adatot törölne.
- **Kézi törlés:** Az adatkezelési szekció szerint: „Törlés vagy korlátozás kéréséhez írj a megadott e-mail címre” (info@gulumen.hu). Tehát **manuális folyamat**, nincs self-service vagy API a törléshez.

---

## 5️⃣ Dashboard / Monitoring

| Funkció | Státusz |
|--------|--------|
| **Admin felület a híváshoz** | ✅ Van: `/admin/dashboard/calls` (bejelentkezés kell: admin login). |
| **Napi hívásszám** | ✅ „Mai hívások” blokk – aznapra szűrt `Call` rekordok száma. |
| **Callback státusz** | ✅ „Visszahívás függőben” – pending CallbackRequest-ek listája (név, teló, téma, idő, link). |
| **Top kérdések** | ✅ „Top címkék (utóbbi 100 hívás)” – tag-ek gyakorisága; valamint „Top témák (címkék)” szekció. |
| **Mai hívások lista** | ✅ callId, idő, nyelv, mode, callerNumber, tags, summary (truncate). |

**Megjegyzés:** A dashboard nem jelenít meg teljes transcriptet a listában (csak summary). A transcript a DB-ben és az e-mailben van (ha consent).

---

## 🎯 Összefoglaló – Mi működik / terv / hiányzik

### ✅ Már működik stabilan
- Webes AI chat (OpenAI + rule-based fallback), `/api/chat`, rate limit.
- „Hívj minket” felület: modal, visszahívás űrlap, `POST /api/callback-request`, DB + opcionális webhook.
- Telefonos backend: **POST /api/ai-voice**, **POST /api/call-summary** (teljes flow: DB, e-mail, Telegram, callback_required).
- DB: Call, CallbackRequest, VoiceApiLog (migrációk megvannak).
- Adatkezelési tájékoztató a **telefonra** (Kapcsolat oldal, HU/EN/DE/RO).
- Admin dashboard: hívások, mai szám, callback pending, top címkék.

### 📋 Terv / konfigurációtól függ
- Éles telefonszám beállítása (`NEXT_PUBLIC_SUPPORT_PHONE`).
- VoIP + voice agent (Vapi/Retell/Twilio) kiválasztása és beállítása.
- Call flow a platformon: nyelvválasztás, consent, majd hívás és webhook hívások a mi backendünkre.

### ❌ Hiányzik vagy gyenge
1. **Webes chat adatkezelés** – Külön tájékoztató, hogy a chat üzeneteket nem tároljuk (vagy ha később tárolnánk, akkor mi a policy).
2. **Konkrét tárolási idő** – Nincs megadva nap/hónap (csak „jogi megtartási kötelezettség”).
3. **Automatikus törlés / retention** – Nincs cron/job a régi Call/transcript vagy CallbackRequest törlésére; törlés csak e-mailes kérésre, manuálisan.
4. **Telefonos indulás kritikus lépései:**  
   - Lefoglalni egy **telefonszámot** (Twilio vagy más).  
   - **Voice agent** (Vapi/Retell/…) regisztráció és konfig: bejövő hívás → STT/TTS, nyelv + consent flow, **end call webhook** a mi `POST /api/call-summary` és (per turn vagy custom) `POST /api/ai-voice` felé, `VOICE_AGENT_WEBHOOK_SECRET` beállítása.  
   - Éles env: `VOICE_AGENT_WEBHOOK_SECRET`, `OPENAI_API_KEY`, opcionálisan `TELEGRAM_*`, `ADMIN_EMAIL`.

---

## Kritikus a telefonos AI induláshoz

1. **Telefonszám** – Lefoglalás (pl. Twilio), és beállítás `NEXT_PUBLIC_SUPPORT_PHONE`.
2. **Voice agent platform** – Választás (Vapi / Retell / Twilio Voice) és bejövő hívás routing.
3. **Platform konfig** – Call flow (nyelv HU/EN, consent), majd:
   - **Per turn (vagy custom) hívás** → `POST /api/ai-voice` (Bearer secret).
   - **Call ended** → `POST /api/call-summary` (ugyanaz a secret), payload a docs szerint.
4. **Környezeti változók** – `VOICE_AGENT_WEBHOOK_SECRET`, `OPENAI_API_KEY`; opcionálisan Telegram, ADMIN_EMAIL, CALLBACK_WEBHOOK_URL.

A weboldal és a backend **készen áll** a fenti külső szolgáltatások bekötésére.
