-- AlterTable: add description_ro to Product (román leírás, AI fordítás)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description_ro" TEXT NOT NULL DEFAULT '';
