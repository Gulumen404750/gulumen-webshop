# 3D nyomtatott termékek – konverzió és optimalizálás

A feltöltött minták (STL, OBJ, stb.) automatikus átalakítása webshopra kész GLB formátumra, optimalizálással.

## Pipeline (2 lépés)

1. **Konvertálás** – STL / OBJ / GLTF / 3MF → GLB (`@polar3d/model-converter`)
2. **Optimalizálás** – tömörítés, mesh optimalizálás, gyorsabb web (`gltf-transform optimize`)

## Telepítés (már a projektben)

```bash
npm install
```

A script használja: `@polar3d/model-converter`, `three`, `@gltf-transform/cli` (devDependencies).

## Használat

### Egy fájl

```bash
# STL → public/models/<név>-optimized.glb
npm run convert-3d -- model.stl

# Kimenet más mappába
npm run convert-3d -- model.stl --out public/models

# OBJ, GLTF, GLB, 3MF is támogatott
npm run convert-3d -- minta.obj --out public/models
```

### Batch (több fájl egyszerre)

1. Tedd a konvertálandó fájlokat a **`scripts/3d-input`** mappába (`.stl`, `.obj`, `.gltf`, `.glb`, `.3mf`).
2. Futtasd:

```bash
npm run convert-3d:batch
```

A kimenet a **`public/models`** mappába kerül: minden fájlból `<név>-optimized.glb`.

## Kimenet

- **Egy fájl:** `<név>-optimized.glb` (alapértelmezetten `public/models/`, vagy `--out` mappa).
- **Batch:** ugyanígy `public/models/<név>-optimized.glb`.

A webshopban a termékoldalon ezt a GLB fájlt töltsd be (pl. `<model-viewer>` vagy Three.js).

## Közvetlen CLI (opcionális)

Ha globálisan telepíted a gltf-transform CLI-t:

```bash
npm install -g @gltf-transform/cli
gltf-transform convert model.stl model.glb
gltf-transform optimize model.glb model-optimized.glb
```

A projekt **`npm run convert-3d`** scriptje ezt a folyamatot egy lépésben, konverzióval együtt végzi.
