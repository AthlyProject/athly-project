CREATE TABLE "planner_health_contexts" (
  "user_id" TEXT NOT NULL PRIMARY KEY,
  "payload" JSONB NOT NULL,
  "time_zone" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planner_health_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "weekly_goals" ADD COLUMN "closed_at" TIMESTAMP(3), ADD COLUMN "closure_reason" TEXT;
ALTER TABLE "plan_generation_jobs" ADD COLUMN "enqueued_at" TIMESTAMP(3), ADD COLUMN "dispatch_lease_until" TIMESTAMP(3);
-- Existing jobs already went through the original SQS publisher.
UPDATE "plan_generation_jobs" SET "enqueued_at" = "created_at";
