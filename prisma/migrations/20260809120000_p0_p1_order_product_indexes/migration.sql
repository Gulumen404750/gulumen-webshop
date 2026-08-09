-- P1: Product indexes (archived already exists on master)
CREATE INDEX IF NOT EXISTS "Product_active_archived_idx" ON "Product"("active", "archived");
CREATE INDEX IF NOT EXISTS "Product_category_active_idx" ON "Product"("category", "active");

-- P1: Order indexes (userId,createdAt may already exist – IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_orderGroupId_idx" ON "Order"("orderGroupId");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_stripeSessionId_idx" ON "Order"("stripeSessionId");
