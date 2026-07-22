-- Make username nullable (no longer required at registration)
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;
