-- CreateTable
CREATE TABLE "LuckySpin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "productIds" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LuckySpin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LuckySpin_userId_weekId_key" ON "LuckySpin"("userId", "weekId");

-- CreateIndex
CREATE INDEX "LuckySpin_userId_expiresAt_idx" ON "LuckySpin"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "LuckySpin" ADD CONSTRAINT "LuckySpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
