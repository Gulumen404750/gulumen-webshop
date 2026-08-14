# Adatbázis backup (admin / Postgres)

A kód nem tárolja a Postgres dumpot a repóban. Az éles adat a **Railway Postgres** szolgáltatásban van.

## Kötelező (platform)

1. Railway → Postgres service → **Backups** / Point-in-time recovery: kapcsold be.
2. A backup **ne** ugyanarra a gép/fiók-jelszó-készletre támaszkodjon, mint az app deploy kulcsai (külön Railway team role, ha lehet).
3. Havonta ellenőrizd, hogy egy dumpból visszaállítható a `Order` / `User` tábla.

## Manuális dump (üzemeltető gép)

```bash
# A DATABASE_URL a Railway dashboardról (ne commitold)
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="gulumen-$(date -u +%Y%m%d).dump"
```

A fájlt titkosítva, **az app szervertől független** tárhelyre tedd (nem `public/`).

## Cron

Napi retention: `GET /api/cron/data-retention` (`CRON_SECRET`). Ez **töröl** régi callback/call adatot, nem backup.
