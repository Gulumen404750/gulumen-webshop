# Node/V8 crash Windows alatt (JIT allocation check failed)

## A hiba

```
# Fatal error in , line 0
# Check failed: jit_page_->allocations_.erase(addr) == 1.
```

Ez egy ismert V8/Node belső hiba, főleg Windows-on, amikor a dev szerver a 3D/model-viewer vagy sok modul fordításakor fut.

## Mit csináltunk

- **ProductModelViewer** most **dinamikusan** töltődik (`next/dynamic` + `ssr: false`), így a 3D kód csak a böngészőben fut, a Node nem dolgozza fel.

## Ha még mindig crash-el

1. **Node verzió**: próbáld a **Node 20 LTS** vagy **22 LTS** (pl. [nodejs.org](https://nodejs.org)).
   ```powershell
   node -v
   ```

2. **NODE_OPTIONS** (csak dev, próbálkozás):
   ```powershell
   $env:NODE_OPTIONS="--max-old-space-size=4096"
   npm run dev
   ```

3. **Egy terminálban** futtasd a dev-et; ne nyisd meg felesleges böngésző tabokkal a főoldalt, amíg a termékoldal (3D) nincs használatban.

4. Ha Sentry be van kapcsolva (`.env`), ideiglenesen kapcsold ki a `SENTRY_DSN`-t, és nézd meg, elmúlik-e a crash.
