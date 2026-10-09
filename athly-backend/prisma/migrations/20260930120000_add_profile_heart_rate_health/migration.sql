ALTER TABLE "users"
  ADD COLUMN "apple_health_resting_heart_rate" INTEGER,
  ADD COLUMN "apple_health_resting_heart_rate_measured_at" TIMESTAMP(3),
  ADD COLUMN "apple_health_heart_rate_captured_at" TIMESTAMP(3);
