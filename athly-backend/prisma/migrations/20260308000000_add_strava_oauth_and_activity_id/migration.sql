-- AlterTable: Integration — add OAuth fields and default UUID
ALTER TABLE "integrations" ADD COLUMN "access_token" TEXT,
ADD COLUMN "refresh_token" TEXT,
ADD COLUMN "token_expires_at" TIMESTAMP(3),
ADD COLUMN "strava_athlete_id" TEXT,
ADD COLUMN "scope" TEXT;

-- AlterTable: Workout — add stravaActivityId
ALTER TABLE "workouts" ADD COLUMN "strava_activity_id" TEXT;

-- CreateIndex: Unique constraint on strava_activity_id
CREATE UNIQUE INDEX "workouts_strava_activity_id_key" ON "workouts"("strava_activity_id");
