-- Készlet: -1 = végtelen / „Készleten”; 0 = elfogyott; >0 = darabszám.
-- Új termékek alapértelmezése végtelen; a korábbi 0-ás raktári készlet (3D) végtelenre áll.

ALTER TABLE "Product" ALTER COLUMN "stock" SET DEFAULT -1;

UPDATE "Product"
SET "stock" = -1
WHERE "type" = 'stock'
  AND "stock" = 0
  AND "category" LIKE '3d-%';
