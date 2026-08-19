-- AlterTable
ALTER TABLE "ChatLog" ADD COLUMN "missingProductSearch" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ChatLog_missingProductSearch_idx" ON "ChatLog"("missingProductSearch");
