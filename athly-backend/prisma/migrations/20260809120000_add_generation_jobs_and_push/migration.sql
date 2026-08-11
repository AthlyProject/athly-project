-- Persist long-running AI generations so an App Runner restart cannot lose them.
CREATE TYPE "PlanGenerationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "PushEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "plan_generation_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start_date" TIMESTAMP(3) NOT NULL,
    "training_plan_id" TEXT,
    "status" "PlanGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "weekly_goal_id" TEXT,
    "workout_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plan_generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "environment" "PushEnvironment" NOT NULL,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_deliveries" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_generation_jobs_user_id_week_start_date_key" ON "plan_generation_jobs"("user_id", "week_start_date");
CREATE UNIQUE INDEX "plan_generation_jobs_weekly_goal_id_key" ON "plan_generation_jobs"("weekly_goal_id");
CREATE INDEX "plan_generation_jobs_status_lease_expires_at_created_at_idx" ON "plan_generation_jobs"("status", "lease_expires_at", "created_at");
CREATE INDEX "plan_generation_jobs_training_plan_id_idx" ON "plan_generation_jobs"("training_plan_id");
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_disabled_at_idx" ON "push_devices"("user_id", "disabled_at");
CREATE UNIQUE INDEX "push_deliveries_generation_id_device_id_key" ON "push_deliveries"("generation_id", "device_id");
CREATE INDEX "push_deliveries_status_next_attempt_at_lease_expires_at_idx" ON "push_deliveries"("status", "next_attempt_at", "lease_expires_at");

ALTER TABLE "plan_generation_jobs" ADD CONSTRAINT "plan_generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_generation_jobs" ADD CONSTRAINT "plan_generation_jobs_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_generation_jobs" ADD CONSTRAINT "plan_generation_jobs_weekly_goal_id_fkey" FOREIGN KEY ("weekly_goal_id") REFERENCES "weekly_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "plan_generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
