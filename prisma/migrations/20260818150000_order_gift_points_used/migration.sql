-- Rendelésen az ajándékpont-felhasználás külön könyvelhető a 30%-os aktivitási ponttól.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftPointsUsed" INTEGER NOT NULL DEFAULT 0;
