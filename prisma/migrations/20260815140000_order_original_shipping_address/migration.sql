-- Vásárlói címmódosítás: eredeti cím megőrzése + változás jelző
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalShippingPostalCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalShippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalShippingStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalShippingHouseNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalCustomerName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "originalCustomerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingAddressChangedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_shippingAddressChangedAt_idx" ON "Order"("shippingAddressChangedAt");
