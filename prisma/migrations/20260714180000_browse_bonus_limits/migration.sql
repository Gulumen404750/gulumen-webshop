-- Browse bonus: max 2x / nap, 12 órás cooldown, session progress külön mezőben
ALTER TABLE "UserDailyActivity" ADD COLUMN IF NOT EXISTS "sessionProgressSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserDailyActivity" ADD COLUMN IF NOT EXISTS "bonusGrantedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserDailyActivity" ADD COLUMN IF NOT EXISTS "lastBonusGrantedAt" TIMESTAMP(3);

UPDATE "UserDailyActivity"
SET "bonusGrantedCount" = 1
WHERE "bonusGranted" = true AND "bonusGrantedCount" = 0;
