-- PaymentTransaction: multi-instance webhook biztonság + gyors orderId lookup
-- providerRef unique: ugyanaz a Stripe PI / provider ref ne kötődjön kétszer

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_providerRef_key" ON "PaymentTransaction"("providerRef");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderId_status_idx" ON "PaymentTransaction"("orderId", "status");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");
