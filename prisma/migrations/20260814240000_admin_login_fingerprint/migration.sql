-- Ismert admin belépési eszközök és országok (új eszköz / szokatlan geo riasztás)
CREATE TABLE IF NOT EXISTS "AdminLoginDevice" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastCountry" TEXT,
    "lastIp" TEXT,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminLoginDevice_fingerprint_key" ON "AdminLoginDevice"("fingerprint");
CREATE INDEX IF NOT EXISTS "AdminLoginDevice_lastSeenAt_idx" ON "AdminLoginDevice"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "AdminLoginCountry" (
    "countryCode" TEXT NOT NULL,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginCountry_pkey" PRIMARY KEY ("countryCode")
);
