-- Személyes kuponpéldány kampánykódból (NYAR2026): egyszer / felhasználó.
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "claimedFromCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_userId_claimedFromCode_key"
  ON "Coupon"("userId", "claimedFromCode");

CREATE INDEX IF NOT EXISTS "Coupon_claimedFromCode_idx" ON "Coupon"("claimedFromCode");
