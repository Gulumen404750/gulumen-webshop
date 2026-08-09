-- Futár megjegyzés + cím típus (lakás / cég)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "addressType" TEXT;
