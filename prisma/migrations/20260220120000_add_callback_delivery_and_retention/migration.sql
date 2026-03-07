-- AlterTable Call: endReason, durationSec, lastPromptKey
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "endReason" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "durationSec" INTEGER;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "lastPromptKey" TEXT;

-- AlterTable CallbackRequest: note, emailSent, webhookSent, deliveryStatus
ALTER TABLE "CallbackRequest" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "CallbackRequest" ADD COLUMN IF NOT EXISTS "emailSent" BOOLEAN;
ALTER TABLE "CallbackRequest" ADD COLUMN IF NOT EXISTS "webhookSent" BOOLEAN;
ALTER TABLE "CallbackRequest" ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;

-- CreateTable DataRetentionLog
CREATE TABLE IF NOT EXISTS "DataRetentionLog" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedCallbacks" INTEGER NOT NULL DEFAULT 0,
    "deletedCallSummaries" INTEGER NOT NULL DEFAULT 0,
    "deletedTranscripts" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL,
    "details" TEXT,

    CONSTRAINT "DataRetentionLog_pkey" PRIMARY KEY ("id")
);
