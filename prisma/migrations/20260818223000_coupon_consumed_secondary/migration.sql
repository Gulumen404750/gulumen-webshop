-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "consumed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "secondaryCouponId" TEXT;
