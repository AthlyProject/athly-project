-- Repair production drift for workout completion metadata.
-- These columns are expected by the current Prisma schema, but older production
-- deploys may have started the API without running the matching migrations.
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "apple_health_workout_uuid" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "is_goal_attempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "actual_distance_meters" DOUBLE PRECISION;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "actual_duration_seconds" DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS "workouts_apple_health_workout_uuid_key" ON "workouts"("apple_health_workout_uuid");
