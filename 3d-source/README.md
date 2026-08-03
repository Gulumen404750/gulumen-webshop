# 3D forrás STL fájlok

Ide tedd a webshop 3D modelljeihez tartozó STL fájlokat (relatív útvonalon, repón belül).

**Szükséges fájlok:**

| Fájlnév a mappában      | Eredeti forrás (példa) |
|-------------------------|-------------------------|
| `noveny-kotozo.stl`     | pl. plantssupportstrapl80.stl (Növény kötöző) |
| `szalveta-tarto-korok.stl` | pl. krouzek stromecek.stl (Szalvéta tartó) |

Ha a fájlok máshol vannak (pl. asztalon egy mappában), másold át őket ide a fenti nevekkel.

Konverzió futtatása (projekt gyökérből):

```bash
npm run convert-3d:webshop
```

A kimenet: `public/models/noveny-kotozo.glb` és `public/models/szalveta-tarto-korok.glb`.

## PNG preview render (Blender)

Automatikus stúdió-render minden `.stl` / `.3mf` fájlhoz:

```bash
blender --background --python 3d-source/gulumen_auto_render.py -- 3d-source
```

A kimenet: ugyanabban a mappában `*.png` (pl. `noveny-kotozo.png`).
