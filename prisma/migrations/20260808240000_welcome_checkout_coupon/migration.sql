-- AlterTable User: welcome checkout coupon redemption flag
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasRedeemedWelcomeCoupon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable MarketingConsent: guest welcome coupon redemption
ALTER TABLE "MarketingConsent" ADD COLUMN IF NOT EXISTS "hasRedeemedWelcomeCoupon" BOOLEAN NOT NULL DEFAULT false;
