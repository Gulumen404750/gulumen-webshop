-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "eligibleItems" JSONB;

-- AlterTable
ALTER TABLE "UserCartSnapshot" ADD COLUMN "restoreTokenHash" TEXT;
ALTER TABLE "UserCartSnapshot" ADD COLUMN "frozenItems" JSONB;
ALTER TABLE "UserCartSnapshot" ADD COLUMN "restoreExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "UserCartSnapshot_restoreTokenHash_key" ON "UserCartSnapshot"("restoreTokenHash");
