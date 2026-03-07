-- CreateTable
CREATE TABLE "ProductReservation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReservation_productId_status_expiresAt_idx" ON "ProductReservation"("productId", "status", "expiresAt");
