-- Egyszer használatos ajándékpont-kódok / NFC-QR tokenek (darabszámos generálás).
CREATE TABLE IF NOT EXISTS "GiftPointBatch" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftPointBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiftPointBatch_active_createdAt_idx" ON "GiftPointBatch"("active", "createdAt");
CREATE INDEX IF NOT EXISTS "GiftPointBatch_code_idx" ON "GiftPointBatch"("code");

ALTER TABLE "GiftPointBatch"
  ADD CONSTRAINT "GiftPointBatch_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GiftPointCode" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "claimedAt" TIMESTAMP(3),
  "claimedByUserId" TEXT,
  "grantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftPointCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GiftPointCode_token_key" ON "GiftPointCode"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "GiftPointCode_grantId_key" ON "GiftPointCode"("grantId");
CREATE INDEX IF NOT EXISTS "GiftPointCode_batchId_claimedAt_idx" ON "GiftPointCode"("batchId", "claimedAt");
CREATE INDEX IF NOT EXISTS "GiftPointCode_claimedByUserId_idx" ON "GiftPointCode"("claimedByUserId");

ALTER TABLE "GiftPointCode"
  ADD CONSTRAINT "GiftPointCode_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "GiftPointBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiftPointCode"
  ADD CONSTRAINT "GiftPointCode_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GiftPointCode"
  ADD CONSTRAINT "GiftPointCode_grantId_fkey"
  FOREIGN KEY ("grantId") REFERENCES "GiftPointGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
