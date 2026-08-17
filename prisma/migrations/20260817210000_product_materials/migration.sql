-- Elérhető 3D nyomtatóanyagok (PLA, PETG, TPU) – admin dropdownból.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "materials" TEXT[] DEFAULT ARRAY[]::TEXT[];
