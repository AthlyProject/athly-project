-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_training_report" JSONB;
ALTER TABLE "users" ADD COLUMN "last_training_report_at" TIMESTAMP(3);
