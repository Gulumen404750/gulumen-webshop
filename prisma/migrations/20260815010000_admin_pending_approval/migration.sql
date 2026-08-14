-- CreateTable
CREATE TABLE "AdminPendingApproval" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requestedById" TEXT,
    "requestedByUsername" TEXT,
    "requestedByRole" TEXT,
    "reviewedById" TEXT,
    "reviewedByUsername" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPendingApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminPendingApproval_status_expiresAt_idx" ON "AdminPendingApproval"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminPendingApproval_createdAt_idx" ON "AdminPendingApproval"("createdAt");
