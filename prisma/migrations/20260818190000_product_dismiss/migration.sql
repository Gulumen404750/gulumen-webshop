-- Explicit kedvencek-törlés / unlike feketelista: ne kerüljön vissza ajánlóba vagy auto-kedvencbe.
CREATE TABLE IF NOT EXISTS "ProductDismiss" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductDismiss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductDismiss_productId_userId_key"
  ON "ProductDismiss"("productId", "userId");

CREATE INDEX IF NOT EXISTS "ProductDismiss_userId_idx" ON "ProductDismiss"("userId");
CREATE INDEX IF NOT EXISTS "ProductDismiss_productId_idx" ON "ProductDismiss"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductDismiss_userId_fkey'
  ) THEN
    ALTER TABLE "ProductDismiss"
      ADD CONSTRAINT "ProductDismiss_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
