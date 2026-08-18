-- NFC ajándékpontok: userhez kötött grant, 1 hónapos lejárat, FIFO levásárlás.
CREATE TABLE IF NOT EXISTS "GiftPointGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "remaining" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'nfc',
  "nfcTagId" TEXT,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftPointGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiftPointGrant_userId_expiresAt_idx" ON "GiftPointGrant"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "GiftPointGrant_nfcTagId_idx" ON "GiftPointGrant"("nfcTagId");

ALTER TABLE "GiftPointGrant"
  ADD CONSTRAINT "GiftPointGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
