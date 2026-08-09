-- P1: Product indexes + archived flag
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Product_active_archived_idx" ON "Product"("active", "archived");
CREATE INDEX IF NOT EXISTS "Product_category_active_idx" ON "Product"("category", "active");

-- P1: Order indexes
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_orderGroupId_idx" ON "Order"("orderGroupId");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_stripeSessionId_idx" ON "Order"("stripeSessionId");

-- P0: PointEvent outbox
CREATE TABLE IF NOT EXISTS "PointEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PointEvent_status_createdAt_idx" ON "PointEvent"("status", "createdAt");
