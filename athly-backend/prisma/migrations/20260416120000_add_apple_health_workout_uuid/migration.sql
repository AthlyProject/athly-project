-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "apple_health_workout_uuid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workouts_apple_health_workout_uuid_key" ON "workouts"("apple_health_workout_uuid");
