# Admin biztonsági szabályzat (belső)

Üzemeltetői szabályok a Gulumen admin felülethez (`/admin`, `/api/admin`).  
Nyilvános sebezhetőség-bejelentés: [SECURITY.md](../SECURITY.md).  
Kulcs beállítása: [ADMIN-API-KULCS-BEALLITAS.md](ADMIN-API-KULCS-BEALLITAS.md).  
Éles checklist: [PRODUCTION-CHECKLIST.md](PRODUCTION-CHECKLIST.md).

Ez a dokumentum **kötelező** mindenki számára, aki admin kulcsot, Railway Variables-t vagy az admin dashboardot kezeli. Nem helyettesíti a kódbeli védelmet: a szabályok akkor is érvényesek, ha egy env változó üresen hagyva átenged (pl. IP-lista).

---

## 1. Ki léphet be

- Csak a webshop üzemeltetői. Nincs külön „vendég admin”, demo kulcs vagy megosztott jelszó chatben.
- Egyetlen belépési titok van: a Railway / env **`ADMIN_API_KEY`**. Ezt **ne** tedd gitbe, screenshotba, ticketbe, Slack/Discord üzenetbe, ügyfélszolgálati válaszba.
- Élesben a kulcs legalább **32 véletlen karakter** (`openssl rand -hex 32`). Ugyanaz a kulcs ne legyen a fejlesztői `.env.local`-ban és a production Variables-ben, ha a gép nem megbízható.
- A nyers kulcs soha nem jelenhet meg a dashboardon. A Beállítások oldal csak annyit jelezhet: be van-e állítva.

---

## 2. Kétlépcsős azonosítás (2FA)

- Éles környezetben a **Google Authenticator (TOTP) 2FA kötelező**. Párosítás: Admin → Beállítások.
- A TOTP titkot / QR-kódot csak a párosítást végző üzemeltető olvassa be; ne küldd el másnak.
- 2FA nélkül a helyes API kulcs önmagában teljes sessiont ad — ezt élesben ne hagyd így.
- A pending 2FA süti rövid életű; ha lejár, az API kulcsot újra meg kell adni.

---

## 3. IP-allowlist

- Élesben add meg az **`ADMIN_ALLOWED_IPS`** változót (vesszővel elválasztott IPv4 / CIDR, pl. iroda + VPN).
- Ha a változó **üres**, a kód **minden IP-t átenged** (logban figyelmeztetés). Ez fejlesztéshez való, productionben **tilos** üresen hagyni.
- Új hálózat / home office: előbb bővítsd a listát, utána próbálj belépni. A login oldal is a listához van kötve.

---

## 4. Session, titkok, csere

Az admin süti **aláírt JWT**. HMAC: **`JWT_SECRET`** (vagy `NEXTAUTH_SECRET`). A token `sv` claimje a `JWT_SECRET` + `ADMIN_API_KEY` hash-e.

| Titok csere | Hatás |
|-------------|--------|
| `JWT_SECRET` | Minden admin session érvénytelen (aláírás nem stimmel). |
| `ADMIN_API_KEY` | A már kiadott sütik `sv` claimje nem stimmel → **kiléptetés**. Nem kell a JWT_SECRET-et is cserélni, de szivárgásnál **mindkettőt** cseréld. |

**Kulcscsere menete (szivárgás vagy rutin):**

1. Generálj új `ADMIN_API_KEY`-t (`openssl rand -hex 32`).
2. Írd be Railway Variables **Value** mezőbe (a Name marad `ADMIN_API_KEY`).
3. Deploy / restart után a régi sütik halottak. Lépj be az **új** kulccsal, erősítsd meg a 2FA-t.
4. A régi kulcsot felejtsd el; ne tarts másolatot jelszókezelőn kívül.

`JWT_SECRET` / `NEXTAUTH_SECRET`: legalább 16 (NextAuthnál 32) karakter, productionben fail-fast. Csere után mindenki újra belép.

---

## 5. CSRF és böngésző

- Mutáló admin API hívások (`POST` / `PUT` / `PATCH` / `DELETE`) CSRF-védelem alatt állnak (double-submit cookie + Origin).
- Az adminban **ne** kapcsold ki a cookie-kat, ne használj idegen Originű eszközt a bejelentkezett sessionnel.
- Kilépés: használd a logoutot. Ne hagyd nyitva az admin fület közös gépen.

---

## 6. Mit szabad / mit nem az adminban

**Szabad (üzemeltetés):** termék, ár, kupon, rendelés státusz, sourcing success/fail, chat/deal beállítások — a dashboard funkcióin belül.

**Tilos:**

- Más üzemeltető sessionjét vagy kulcsát elkérni „csak gyorsan”.
- Tömeges árváltoztatás vagy tömeges törlés ellenőrzés nélkül (vásárlói ár / készlet).
- Rendelés-exportot (személyes adatok: név, cím, e-mail, telefon) nem admin gépre, nyilvános drive-ra, vagy ügyfélnek továbbítani.
- Production `DATABASE_URL`, Stripe, webhook titkok másolása saját gépre „debug miatt”, ha van Railway one-off / log.
- A `/admin` URL-t marketingben, footerben, ügyfél-emailben hirdetni.

A belépések és a releváns műveletek az **`AdminAction`** audit táblába mennek (IP, user-agent, siker/kudarc). Az auditot ne kapcsold ki, ne töröld rutinból.

---

## 7. Rate limit és brute force

- Hibás admin belépés rate limitezett. Sikeres kulcs után a 2FA kód külön limit alatt van.
- Sok 401 / 429 a logban: kezeld incidensként (lásd §8), ne „próbálgass tovább” ugyanarról az IP-ről élesben.

---

## 8. Incidens (elveszett kulcs, gyanús belépés)

1. Cseréld az **`ADMIN_API_KEY`**-t (sessionök érvénytelenek).
2. Ha a JWT titok is kikerülhetett: cseréld a **`JWT_SECRET`** / **`NEXTAUTH_SECRET`**-et is.
3. Ellenőrizd az audit logot (sikertelen login, termék törlés, bulk ár, rendelés export).
4. Stripe / webhook / `DATABASE_URL` szivárgásnál az adott titkot is rotáld a szolgáltatónál.
5. Nyilvános sebezhetőség (nem üzemeltetői hiba): [SECURITY.md](../SECURITY.md) szerint, ne nyilvános issue-ban.

---

## 9. Fejlesztés vs. éles

| | Fejlesztés | Éles (Railway) |
|--|------------|----------------|
| `ADMIN_API_KEY` | saját `.env.local`, nem a prod kulcs | erős, egyedi |
| 2FA | ajánlott | **kötelező** |
| `ADMIN_ALLOWED_IPS` | lehet üres | **kötelező kitölteni** |
| Titkok a gitben | soha | soha |
| Admin URL | `/admin/login` | ne publikáld |
| Deploy | feature / `staging` | `master` → **gulumen-webshop** (`www`) |

Admin / auth **kód**változás (middleware, session, 2FA, IP-lista, login): először a **staging** service, saját `ADMIN_API_KEY` / `JWT_SECRET` / Postgres — ne egyből a `www.gulumen.com`. Lépések: [STAGING.md](STAGING.md).

`.env` / `.env.local` a `.gitignore`-ban van. A repo `.env.example` csak üres placeholder.

---

## 10. Kapcsolódó kód (tájékoztató)

| Téma | Hol |
|------|-----|
| Session verify | `src/lib/admin-session.ts`, `src/lib/admin-session-edge.ts` |
| Session verzió (`sv`) | `src/lib/admin-session-version.ts` |
| IP-lista | `src/lib/admin-ip-allowlist.ts`, `src/middleware.ts` |
| CSRF | `src/lib/admin-csrf.ts` |
| 2FA | `src/lib/admin-2fa.ts`, `/api/admin/2fa/*` |
| Audit | `src/lib/admin-audit.ts`, `AdminAction` |
| Belépés | `POST /api/admin/login` |
| Staging kapu (deploy) | [STAGING.md](STAGING.md) — `gulumen-webshop-staging`, GitHub Environment |
