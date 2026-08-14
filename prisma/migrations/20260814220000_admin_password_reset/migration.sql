-- Admin jelszó + rövid életű reset token + session epoch (jelszócsere után JWT invalidálás)
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "sessionEpoch" INTEGER NOT NULL DEFAULT 0;
