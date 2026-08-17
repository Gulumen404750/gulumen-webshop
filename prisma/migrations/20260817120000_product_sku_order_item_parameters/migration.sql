-- Belső termékkód / SKU a termékeken (UNIQUE, NULL megengedett)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku");

-- Rendelési tétel: SKU pillanatkép + egyedi gyártási paraméterek
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(50);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "parameters" JSONB;

CREATE INDEX IF NOT EXISTS "OrderItem_sku_idx" ON "OrderItem"("sku");
