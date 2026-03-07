-- CreateTable: Product – webshop termékek, adminból kezelhetők. Sourcing időzítés DB-ben.
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameDe" TEXT,
    "nameRo" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "condition" TEXT NOT NULL DEFAULT 'Új',
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images360" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelUrl" TEXT,
    "priceHuf" INTEGER NOT NULL,
    "priceEur" INTEGER NOT NULL,
    "discountPriceHuf" INTEGER,
    "discountPriceEur" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "onSale" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isColorable" BOOLEAN NOT NULL DEFAULT false,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'stock',
    "sourcingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dealStartAt" TIMESTAMP(3),
    "dealEndAt" TIMESTAMP(3),
    "previewFrom" TIMESTAMP(3),
    "maxOrders" INTEGER,
    "sourcingStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Coupon – kuponok / kedvezmények
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "minOrderHuf" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Setting – admin/chatbot/webshop beállítások key-value
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
