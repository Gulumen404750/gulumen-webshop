# Admin API kulcs beállítása (helyi + Railway)

Az **Admin belépés** az alábbi környezeti változóval működik. Ha nincs beállítva, a `/admin/login` oldalon „Admin not configured” hibát kapsz.

---

## Admin kulcs – mi marad, hova írsz

| | |
|---|---|
| **Változó neve** (ezt ne töröld, ne változtasd) | `ADMIN_API_KEY` |
| **Hova írod a titkos kódot** | 👉 Az **egyenlőségjel után** (helyi fájlban), vagy Railway **Value** mezőbe. |

**Példa helyi fájlban (.env / .env.local):**
```env
ADMIN_API_KEY=ide_írod_a_generált_kulcsot
```
↑ A bal oldal (`ADMIN_API_KEY`) maradjon így. Az `=` után (jobb oldal) kerül a generált kulcs.

**Példa Railway-ben (Variables):**
- **Name:** `ADMIN_API_KEY` (változatlanul)
- **Value:** ide írod a generált kulcsot

---

## 1. Kulcs generálása

Használj egy erős, véletlenszerű kulcsot (min. 32 karakter).

**PowerShell (Windows):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

**Git Bash / WSL / Linux / Mac:**
```bash
openssl rand -hex 32
```

Másold ki a generált értéket – ezt írod be az **=` után** (helyi) vagy a Railway **Value** mezőbe.

---

## 2. Helyi beállítás (fejlesztés)

1. A projekt gyökerében hozz létre **`.env.local`** fájlt (vagy másold át a `.env.example`-ot és nevezd át `.env`-re).
2. Egy sor:
   ```env
   ADMIN_API_KEY=ide_írod_a_generált_kulcsot
   ```
   → A **=` után** írd a generált kulcsot. Szóköz ne legyen az `=` körül.
3. Indítsd újra a dev szervert (`npm run dev`). Belépésnél ugyanazt a kulcsot írd be az „API kulcs” mezőbe.

---

## 3. Railway-ben beállítás

1. [Railway Dashboard](https://railway.app) → válaszd ki a projektet.
2. **Variables** fül → **+ New Variable**.
3. **Name:** `ADMIN_API_KEY` (pont így, ne töröld ki).
4. **Value:** ide beilleszted a generált kulcsot (ugyanaz, amit helyben használsz).
5. Mentsd. A következő deploy után az admin belépés működni fog.

---

## Összefoglaló

| Környezet | Változó neve (ne töröld) | Hova írod a kulcsot |
|-----------|--------------------------|----------------------|
| **Helyi** | `ADMIN_API_KEY` | `.env` / `.env.local` fájlban az **=` után** |
| **Railway** | `ADMIN_API_KEY` | Variables → **Value** mező |

A `.env` és `.env.local` ne kerüljön gitbe. Railway-n a Value csak a dashboardon látszik, ne írd be a kódba.

Üzemeltetési szabályok (2FA, IP-lista, kulcscsere, incidens): [Admin biztonsági szabályzat](ADMIN-BIZTONSAGI-SZABALYZAT.md). Sebezhetőség-bejelentés: [SECURITY.md](../SECURITY.md).
