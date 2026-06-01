-- AlterTable
ALTER TABLE "users" ADD COLUMN     "revenue_cat_user_id" TEXT,
ADD COLUMN     "subscription_expires_at" TIMESTAMP(3),
ADD COLUMN     "subscription_product_id" TEXT,
ADD COLUMN     "subscription_status" TEXT;
