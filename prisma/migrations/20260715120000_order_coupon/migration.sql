-- Order: DB kupon hivatkozás checkout során + egyszeri felhasználás rögzítése
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponUsageRecorded" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order"("couponId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
