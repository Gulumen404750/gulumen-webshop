-- P0: missing indexes for OrderItem.productId and Order.paymentIntentId
-- Idempotent / non-destructive.

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "Order_paymentIntentId_idx" ON "Order"("paymentIntentId");
