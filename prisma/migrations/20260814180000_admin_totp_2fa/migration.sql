-- Singleton admin fiók TOTP 2FA mezőkkel
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL DEFAULT 'admin',
    "totpSecret" TEXT,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);
