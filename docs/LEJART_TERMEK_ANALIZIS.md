# Mély elemzés: miért kerül vissza a lejárt termék?

## Lehetséges okok

1. **Hydration mismatch**  
   A `useState(getStoredHiddenExpiredIds)` a szerveren `new Set()` (nincs sessionStorage), a kliensen pedig a tárolt id-kkel indul. A szerver HTML-ben benne van a termék, a kliens meg rejtené → React hydration warning / helyreállítás, a termék megmaradhat.

2. **Remount után üres state**  
   A `router.refresh()` újra lefuttatja a szerver komponenst; a kliens fa részben újra mountolódhat. Ha a state kezdőértéke nem a sessionStorage-ból jön (pl. szerveren üres), a remountolt komponens üres rejtett listával indulhat.

3. **sessionStorage csak kliensen**  
   A kezdő state `getStoredHiddenExpiredIds()` a szerveren mindig üres set. Ha bármikor a szerver és kliens kezdőértéke eltér, hydration probléma adódhat.

4. **Szerver: SEED_NOW**  
   A mock adat `SEED_NOW`-t használ (első betöltéskor rögzített). Dev hot reloadnál a modul újratöltődhet, `SEED_NOW` frissül → a „teszt” termék újra 5 percig aktív, a szerver visszaadja.

## Következtetés

A kliensnek kell egyértelműen dönteni: **ha egy termék id egyszer már „lejártnak” lett megjelölve (sessionStorage), azt a session alatt soha ne mutassa a Beszerzésre rendelhető listán**, függetlenül a state-től és a remount-tól. A listát minden renderkor a sessionStorage alapján is szűrni, de az épp animálódó termékeket továbbra is megjeleníteni (animáció miatt).
