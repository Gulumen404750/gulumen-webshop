# Kedvelésszám (nyilvános, közös adat)

## Mi ez?

A **„mennyien tették kedvencek közé”** szám minden látogató által látható, **nyilvános, közös adat**.  
Ha valaki kedvencekhez adja a terméket (szív kattintás), a szám nő; ha eltávolítja, a szám csökken.  
**Mindenki ugyanazt a számot látja** (külön böngésző, külön eszköz, külön e-mail/bejelentkezés).

## Hogyan működik?

1. **Egy szív gomb**: A termék kártyán és a termékoldalon egyetlen „kedvencekhez” gomb van. Ha rákattintasz:
   - a termék bekerül a te kedvenceid listájába (vagy kikerül onnan),
   - a **nyilvános kedvelésszám** azonnal frissül az API-n keresztül (növekszik vagy csökken).
2. **Közös szám**: A számot a szerver tárolja. Bárki betölti az oldalt, ugyanazt a számot kéri le (GET `/api/products/[id]/like`), ezért **mindenki ugyanazt látja**.
3. **Interaktív**: Ha egy másik böngészőben vagy eszközön valaki szívez, majd te frissíted az oldalt (vagy más termékre majd vissza), a friss szám látszik.

## Adattárolás

- **Fejlesztés / self‑hosted**: A szám perzisztálódik a `data/likes.json` fájlba, így szerver újraindítás után is megmarad.
- **Éles (pl. Vercel)**: A fájlrendszer nem perzisztens. Éles környezetben érdemes adatbázist (pl. PostgreSQL, Redis) vagy külső store-t használni; a like API kommentjei ezt jelzik.

## API

- **GET** `/api/products/[id]/like` → `{ likesCount: number }` – aktuális nyilvános kedvelésszám.
- **POST** `/api/products/[id]/like` – body: `{ currentlyLiked: boolean }` (toggle előtti állapot).  
  Vissza: `{ likesCount: number, liked: boolean }`.

A részletek az API route forráskódjában (kommentek) is dokumentáltak.
