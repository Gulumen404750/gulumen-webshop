-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "callerNumber" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "transcript" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallbackRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "topic" TEXT,
    "preferredTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceApiLog" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "callId" TEXT,
    "consent" BOOLEAN,
    "success" BOOLEAN NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Call_callId_key" ON "Call"("callId");
-- CreateIndex
CREATE INDEX "Call_timestamp_idx" ON "Call"("timestamp");
-- CreateIndex
CREATE INDEX "Call_callId_idx" ON "Call"("callId");
-- CreateIndex
CREATE INDEX "CallbackRequest_status_idx" ON "CallbackRequest"("status");
-- CreateIndex
CREATE INDEX "CallbackRequest_createdAt_idx" ON "CallbackRequest"("createdAt");
-- CreateIndex
CREATE INDEX "VoiceApiLog_createdAt_idx" ON "VoiceApiLog"("createdAt");
