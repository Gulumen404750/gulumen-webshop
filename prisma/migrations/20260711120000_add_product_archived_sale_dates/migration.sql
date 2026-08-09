-- AlterTable: archiválás és időzített akció támogatás
ALTER TABLE "Product" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "saleStartAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "saleEndAt" TIMESTAMP(3);
