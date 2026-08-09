-- CreateTable
CREATE TABLE "UserCartSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "subtotalHuf" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOfferAt" TIMESTAMP(3),
    "lastOfferPercent" INTEGER,
    "lastOfferCouponId" TEXT,

    CONSTRAINT "UserCartSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCartSnapshot_userId_key" ON "UserCartSnapshot"("userId");

-- CreateIndex
CREATE INDEX "UserCartSnapshot_lastUpdatedAt_idx" ON "UserCartSnapshot"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "UserCartSnapshot_itemCount_idx" ON "UserCartSnapshot"("itemCount");

-- AddForeignKey
ALTER TABLE "UserCartSnapshot" ADD CONSTRAINT "UserCartSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
