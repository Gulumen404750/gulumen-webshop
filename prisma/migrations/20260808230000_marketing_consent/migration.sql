-- User marketing consent fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptOutAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptInSource" TEXT;

-- MarketingConsent (email-level + unsubscribe token)
CREATE TABLE IF NOT EXISTS "MarketingConsent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "unsubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingConsent_email_key" ON "MarketingConsent"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingConsent_unsubToken_key" ON "MarketingConsent"("unsubToken");
CREATE INDEX IF NOT EXISTS "MarketingConsent_optedIn_confirmed_idx" ON "MarketingConsent"("optedIn", "confirmed");
