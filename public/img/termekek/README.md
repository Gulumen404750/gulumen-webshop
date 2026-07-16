# Kész termékképek

**Ide csak a kész, feltöltésre kész termékfotókat tedd.**

## Szabályok

- Egy termék = egyértelmű fájlnév (pl. `noveny-kotozo-01.webp`)
- Több kép ugyanahhoz a termékhez: `termeknev-01`, `termeknev-02`, …
- Formátum: `.webp`, `.jpg` vagy `.png` (lehetőleg WebP)
- Ne ide tedd a nyers / félkész / vágatlan fotókat

## Hogyan használd az adminban

1. Másold ide a kész képet (pl. `public/img/termekek/noveny-kotozo-01.webp`)
2. Admin → Termékek → Új termék
3. Kép URL mezőbe: `/img/termekek/noveny-kotozo-01.webp`

A böngészőben ez lesz: `https://gulumen.hu/img/termekek/noveny-kotozo-01.webp`

## Mi hova tartozik

| Anyag | Mappa |
|--------|--------|
| Kész termékképek | `public/img/termekek/` ← **ez** |
| 3D modellek (GLB) | `public/models/` |
| Nyers STL | `3d-source/` vagy `scripts/3d-input/` |
| Adminból feltöltött képek | `public/uploads/` (élesben ideiglenes lehet) |
