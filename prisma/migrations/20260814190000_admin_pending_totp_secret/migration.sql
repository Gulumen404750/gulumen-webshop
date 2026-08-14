-- AlterTable
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "pendingTotpSecret" TEXT;
