-- Admin audit: IP, user-agent, lookup indexes
ALTER TABLE "AdminAction" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAction_action_idx" ON "AdminAction"("action");
