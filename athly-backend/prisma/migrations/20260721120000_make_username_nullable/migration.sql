-- Make username nullable (no longer required at registration)
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;
