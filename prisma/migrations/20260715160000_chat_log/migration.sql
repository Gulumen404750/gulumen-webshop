-- CreateTable
CREATE TABLE "ChatLog" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionNorm" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'hu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatLog_questionNorm_idx" ON "ChatLog"("questionNorm");

-- CreateIndex
CREATE INDEX "ChatLog_createdAt_idx" ON "ChatLog"("createdAt");
