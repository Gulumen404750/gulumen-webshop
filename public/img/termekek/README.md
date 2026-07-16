# Kész termékképek + tömeges import

**Ide csak a kész termékfotókat tedd.** A webshopba nem kerülnek fel maguktól — futtasd az import scriptet (lásd lent).

## Ajánlott mappastruktúra

```
public/img/termekek/
  3d-kert/
    noveny-kotozo/
      01.webp
      02.webp
  3d-konyha/
    szalveta-tarto/
      01.webp
  taskak/
    rolltop-fekete/
      01.webp
```

### Engedélyezett kategória mappanevek

`taskak`, `ruhazat`, `kiegeszitok`, `elektronika`, `otthon`,  
`3d-nyomtatott`, `3d-konyha`, `3d-jatek`, `3d-kert`, `3d-lakasdekor`,  
`3d-eszkozok`, `3d-kreativ`, `3d-ajandek`

## Tömeges feltöltés az adatbázisba (nem egyesével)

1. Rakd be a képeket a fenti struktúrába.
2. (Opcionális) Árak / nevek CSV-ben: `products.csv` ebben a mappában:

```csv
slug,name,priceHuf,stock,category
noveny-kotozo,Növény kötöző,2490,20,3d-kert
```

3. Projekt gyökeréből, `DATABASE_URL` beállítva:

```bash
# előnézet (nem ír DB-t)
npx tsx scripts/import-termekek-from-folder.ts --dry-run

# import alapárral
npx tsx scripts/import-termekek-from-folder.ts --price=3990 --stock=10
```

4. A képeknek az éles szerveren is ott kell lenniük (git push + deploy), különben a termék lesz, a kép nem jelenik meg.

## Admin URL példa

`/img/termekek/3d-kert/noveny-kotozo/01.webp`
