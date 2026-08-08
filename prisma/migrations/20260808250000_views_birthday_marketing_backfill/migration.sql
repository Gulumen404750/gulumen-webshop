-- Product views + User birthDate + marketing backfill for existing users

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthdayCouponLastSentYear" INTEGER;

-- Meglévő felhasználók: mind feliratkozott (marketing e-mail küldhető)
UPDATE "User"
SET
  "marketingOptIn" = true,
  "marketingOptInAt" = COALESCE("marketingOptInAt", NOW()),
  "marketingOptInSource" = COALESCE("marketingOptInSource", 'admin'),
  "marketingOptOutAt" = NULL;

-- MarketingConsent sor minden user e-mailhez (upsert)
INSERT INTO "MarketingConsent" (
  "id",
  "email",
  "optedIn",
  "confirmed",
  "source",
  "optedInAt",
  "optedOutAt",
  "unsubToken",
  "hasRedeemedWelcomeCoupon",
  "createdAt",
  "updatedAt"
)
SELECT
  'c' || substr(md5(random()::text || u.id || clock_timestamp()::text), 1, 24),
  u.email,
  true,
  true,
  COALESCE(u."marketingOptInSource", 'admin'),
  COALESCE(u."marketingOptInAt", NOW()),
  NULL,
  md5(random()::text || u.id || clock_timestamp()::text) || md5(u.email || random()::text),
  COALESCE(u."hasRedeemedWelcomeCoupon", false),
  NOW(),
  NOW()
FROM "User" u
ON CONFLICT ("email") DO UPDATE SET
  "optedIn" = true,
  "confirmed" = true,
  "optedOutAt" = NULL,
  "optedInAt" = COALESCE("MarketingConsent"."optedInAt", EXCLUDED."optedInAt"),
  "source" = COALESCE("MarketingConsent"."source", EXCLUDED."source"),
  "updatedAt" = NOW();
