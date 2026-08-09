-- Admin címkenyomtatás jelző
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Order_printedAt_idx" ON "Order"("printedAt");
