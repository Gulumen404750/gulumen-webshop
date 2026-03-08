-- AlterTable: User.passwordHash optional (Google OAuth users have no password)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
