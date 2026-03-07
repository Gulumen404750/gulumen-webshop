# 3D modellek (GLB)

A 3D nyomtatott termékek forgatható megjelenítéséhez a GLB fájlok ide kerülnek.

- **noveny-kotozo.glb** – Növény kötöző
- **szalveta-tarto-korok.glb** – Szalvéta tartó

## Generálás

A fájlok a forrás STL-ekből a webshop pipeline-mal generálhatók (projekt gyökérből):

```bash
npm run convert-3d:webshop
```

A bemeneti STL-ek a **3d-source/** mappában vannak (lásd `scripts/3d-webshop-paths.json`).  
Ha valódi modelleket használsz, cseréld ki a `3d-source/` tartalmát a megfelelő STL fájlokra, majd futtasd újra a parancsot.
