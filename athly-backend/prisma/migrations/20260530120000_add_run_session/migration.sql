-- CreateTable
CREATE TABLE "run_sessions" (
    "id" TEXT NOT NULL,
    "sport_type" "SportType" NOT NULL DEFAULT 'running',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "duration_seconds" DOUBLE PRECISION NOT NULL,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "avg_pace_seconds_per_km" DOUBLE PRECISION NOT NULL,
    "elevation_gain_meters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "route" JSONB NOT NULL,
    "splits" JSONB NOT NULL,
    "apple_health_workout_uuid" TEXT,
    "workout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "run_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_sessions_user_id_idx" ON "run_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "run_sessions" ADD CONSTRAINT "run_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
