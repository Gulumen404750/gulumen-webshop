-- Biztonságos token a visszaigazoló e-mail címmódosító linkhez
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingEditToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_shippingEditToken_key" ON "Order"("shippingEditToken");
