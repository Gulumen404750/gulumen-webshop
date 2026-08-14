-- Admin JWT denylist (logout / idle revoke)
CREATE TABLE IF NOT EXISTS "AdminRevokedSession" (
  "jti" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminRevokedSession_pkey" PRIMARY KEY ("jti")
);
CREATE INDEX IF NOT EXISTS "AdminRevokedSession_expiresAt_idx" ON "AdminRevokedSession"("expiresAt");
