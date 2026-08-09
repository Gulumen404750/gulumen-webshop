-- Order: szállítási / számlázási / kapcsolattartó adatok a checkoutból

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingPostalCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingHouseNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingSameAsShipping" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingPostalCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingHouseNumber" TEXT;
