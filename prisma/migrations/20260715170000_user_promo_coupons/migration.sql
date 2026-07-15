-- CreateTable
CREATE TABLE "UserPromoCoupon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'claimed',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "UserPromoCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPromoCoupon_userId_kind_key" ON "UserPromoCoupon"("userId", "kind");

-- CreateIndex
CREATE INDEX "UserPromoCoupon_kind_status_idx" ON "UserPromoCoupon"("kind", "status");

-- CreateIndex
CREATE INDEX "UserPromoCoupon_claimedAt_idx" ON "UserPromoCoupon"("claimedAt");

-- AddForeignKey
ALTER TABLE "UserPromoCoupon" ADD CONSTRAINT "UserPromoCoupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
