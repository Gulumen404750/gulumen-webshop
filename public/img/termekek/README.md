# Kész termékképek + tömeges import

## A te mappád (Windows)

Ha van ilyen mappád:

`Veboldalhoz termékek google igazítással` → belül `termekek` → kategorizált almappák

akkor **nem kell egyesével** feltölteni. Cursorban, a **Veboldal** projekt gyökeréből:

```bash
# 1) Előnézet (mit találna meg)
npx tsx scripts/import-termekek-from-folder.ts --source="C:\Users\IDE ÍRD A TELJES ÚTVONALAT\Veboldalhoz termékek google igazítással" --copy --dry-run

# 2) Import + képek másolása a webshopba
npx tsx scripts/import-termekek-from-folder.ts --source="C:\Users\...\Veboldalhoz termékek google igazítással" --copy --price=3990 --stock=10
```

A `--copy` bemásolja a képeket ide: `public/img/termekek/...`  
Az import létrehozza a termékeket az adatbázisban.

## Elvárt struktúra a forrásmappában

```
Veboldalhoz termékek google igazítással/
  termekek/                    ← vagy közvetlenül a kategóriák
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

### Kategória mappanevek

`taskak`, `ruhazat`, `kiegeszitok`, `elektronika`, `otthon`,  
`3d-nyomtatott`, `3d-konyha`, `3d-jatek`, `3d-kert`, `3d-lakasdekor`,  
`3d-eszkozok`, `3d-kreativ`, `3d-ajandek`

## Opcionális árlista

`products.csv` a forrásmappában vagy itt:

```csv
slug,name,priceHuf,stock,category
noveny-kotozo,Növény kötöző,2490,20,3d-kert
```
