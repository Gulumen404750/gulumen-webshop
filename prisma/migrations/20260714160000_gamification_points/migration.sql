-- Gamification: pontrendszer, outbox, napi aktivitás/lájk progress

-- Coupon bővítés (gamification kuponok)
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "pointTransactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_pointTransactionId_key" ON "Coupon"("pointTransactionId");
CREATE INDEX IF NOT EXISTS "Coupon_userId_active_idx" ON "Coupon"("userId", "active");
CREATE INDEX IF NOT EXISTS "Coupon_source_idx" ON "Coupon"("source");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProductLike: napi bónusz + indexek
ALTER TABLE "ProductLike" ADD COLUMN IF NOT EXISTS "countsForDailyBonus" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "ProductLike_userId_createdAt_idx" ON "ProductLike"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductLike_createdAt_idx" ON "ProductLike"("createdAt");

-- UserPointWallet
CREATE TABLE IF NOT EXISTS "UserPointWallet" (
  "userId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
  "lifetimeRedeemed" INTEGER NOT NULL DEFAULT 0,
  "gamificationSuspended" BOOLEAN NOT NULL DEFAULT false,
  "suspendedAt" TIMESTAMP(3),
  "suspendReason" TEXT,
  "lastReconciledAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPointWallet_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserPointWallet_balance_nonneg" CHECK ("balance" >= 0)
);

ALTER TABLE "UserPointWallet" ADD CONSTRAINT "UserPointWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PointTransaction (append-only)
CREATE TABLE IF NOT EXISTS "PointTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointTransaction_delta_nonzero" CHECK ("delta" <> 0),
  CONSTRAINT "PointTransaction_balanceAfter_nonneg" CHECK ("balanceAfter" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointTransaction_idempotencyKey_key" ON "PointTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointTransaction_type_createdAt_idx" ON "PointTransaction"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "PointTransaction_referenceType_referenceId_idx" ON "PointTransaction"("referenceType", "referenceId");

ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PointEvent outbox
CREATE TABLE IF NOT EXISTS "PointEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointEvent_idempotencyKey_key" ON "PointEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PointEvent_status_scheduledAt_idx" ON "PointEvent"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "PointEvent_userId_createdAt_idx" ON "PointEvent"("userId", "createdAt");

ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PointSnapshot
CREATE TABLE IF NOT EXISTS "PointSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "balance" INTEGER NOT NULL,
  "txCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointSnapshot_userId_date_key" ON "PointSnapshot"("userId", "date");
CREATE INDEX IF NOT EXISTS "PointSnapshot_date_idx" ON "PointSnapshot"("date");

-- UserDailyActivity
CREATE TABLE IF NOT EXISTS "UserDailyActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityDate" DATE NOT NULL,
  "activeSeconds" INTEGER NOT NULL DEFAULT 0,
  "bonusGranted" BOOLEAN NOT NULL DEFAULT false,
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDailyActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserDailyActivity_activeSeconds_nonneg" CHECK ("activeSeconds" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDailyActivity_userId_activityDate_key" ON "UserDailyActivity"("userId", "activityDate");
CREATE INDEX IF NOT EXISTS "UserDailyActivity_activityDate_idx" ON "UserDailyActivity"("activityDate");

ALTER TABLE "UserDailyActivity" ADD CONSTRAINT "UserDailyActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserDailyLikeProgress
CREATE TABLE IF NOT EXISTS "UserDailyLikeProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "progressDate" DATE NOT NULL,
  "qualifyingLikeCount" INTEGER NOT NULL DEFAULT 0,
  "bonusGranted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDailyLikeProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserDailyLikeProgress_qualifyingLikeCount_nonneg" CHECK ("qualifyingLikeCount" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDailyLikeProgress_userId_progressDate_key" ON "UserDailyLikeProgress"("userId", "progressDate");
CREATE INDEX IF NOT EXISTS "UserDailyLikeProgress_progressDate_idx" ON "UserDailyLikeProgress"("progressDate");

ALTER TABLE "UserDailyLikeProgress" ADD CONSTRAINT "UserDailyLikeProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meglévő userek: üres wallet (balance 0)
INSERT INTO "UserPointWallet" ("userId", "balance", "updatedAt")
SELECT "id", 0, CURRENT_TIMESTAMP FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "UserPointWallet" w WHERE w."userId" = u."id");
