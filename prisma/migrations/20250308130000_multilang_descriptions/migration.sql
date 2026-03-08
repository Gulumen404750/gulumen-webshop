-- Add new description columns
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description_hu" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description_en" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description_de" TEXT NOT NULL DEFAULT '';

-- Migrate existing description to all three (only if description column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'description') THEN
    UPDATE "Product" SET "description_hu" = COALESCE("description", ''), "description_en" = COALESCE("description", ''), "description_de" = COALESCE("description", '');
    ALTER TABLE "Product" DROP COLUMN "description";
  END IF;
END $$;
