-- Időkorlátos / limitált beszerzéses termékek eltávolítása a bolt nézetből (archiválás).
-- Rendeléselőzmények miatt hard delete helyett soft-archive.

UPDATE "Product"
SET
  "archived" = true,
  "active" = false,
  "sourcingEnabled" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'sourcing_deal'
  AND ("archived" = false OR "active" = true OR "sourcingEnabled" = true);

-- Időzített akciók kikapcsolása (sale ablakos készletes termékek).
UPDATE "Product"
SET
  "onSale" = false,
  "saleStartAt" = NULL,
  "saleEndAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'stock'
  AND (
    "onSale" = true
    OR "saleStartAt" IS NOT NULL
    OR "saleEndAt" IS NOT NULL
  );
