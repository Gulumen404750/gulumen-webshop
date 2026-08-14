-- mustChangeKey: következő belépéshez új ADMIN_API_KEY; fingerprint a last-accepted kulcshoz
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "mustChangeKey" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "apiKeyFingerprint" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "keyConfirmedAt" TIMESTAMP(3);
