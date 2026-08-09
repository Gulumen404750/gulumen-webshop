-- fix(prisma): resolve migration drift between main and master
--
-- Context:
--   * Production Railway DB follows the `master` migration history.
--   * `main` briefly introduced a divergent migration
--     `20260809110000_p0_p1_indexes_point_event` (simpler PointEvent + indexes).
--   * That migration is REMOVED from the repo; it is fully superseded by:
--       - 20260714160000_gamification_points  (rich PointEvent outbox + wallet)
--       - 20260809120000_p0_p1_order_product_indexes (Product/Order indexes)
--
-- This migration is intentionally idempotent and NON-DESTRUCTIVE.
-- No DROP TABLE / DROP COLUMN / ALTER TYPE. Safe on production (no-op if present).

-- Product: archived flag (already present on master / production)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- P1 indexes mirrored from both branches (IF NOT EXISTS → no-op when present)
CREATE INDEX IF NOT EXISTS "Product_active_archived_idx" ON "Product"("active", "archived");
CREATE INDEX IF NOT EXISTS "Product_category_active_idx" ON "Product"("category", "active");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_orderGroupId_idx" ON "Order"("orderGroupId");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_stripeSessionId_idx" ON "Order"("stripeSessionId");

-- Compatibility index used by main-era outbox scans (safe if PointEvent exists).
-- On production (master gamification PointEvent) this is additive only.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PointEvent'
  ) THEN
    CREATE INDEX IF NOT EXISTS "PointEvent_status_createdAt_idx"
      ON "PointEvent"("status", "createdAt");
  END IF;
END $$;
