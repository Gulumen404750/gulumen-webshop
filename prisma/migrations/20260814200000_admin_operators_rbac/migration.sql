-- AlterTable
ALTER TABLE "AdminAction" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN IF NOT EXISTS "actorUsername" TEXT;
ALTER TABLE "AdminAction" ADD COLUMN IF NOT EXISTS "actorRole" TEXT;

CREATE INDEX IF NOT EXISTS "AdminAction_actorId_idx" ON "AdminAction"("actorId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminOperator" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminOperator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminOperator_username_key" ON "AdminOperator"("username");
CREATE INDEX IF NOT EXISTS "AdminOperator_role_idx" ON "AdminOperator"("role");
