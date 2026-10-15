-- Campo de dados da Athly no Garmin: tipo do app pareado e corridas enviadas pelo relógio (cabeçalho
-- + blocos binários da rota), que esperam o atleta confirmar no app.
-- CreateEnum
CREATE TYPE "ConnectIqDeviceKind" AS ENUM ('watch_app', 'data_field');

-- CreateEnum
CREATE TYPE "ConnectIqActivityStatus" AS ENUM ('receiving', 'ready', 'resolved');

-- AlterTable
ALTER TABLE "connect_iq_devices" ADD COLUMN     "kind" "ConnectIqDeviceKind" NOT NULL DEFAULT 'watch_app';

-- AlterTable
ALTER TABLE "connect_iq_pairings" ADD COLUMN     "kind" "ConnectIqDeviceKind" NOT NULL DEFAULT 'watch_app';

-- CreateTable
CREATE TABLE "connect_iq_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "client_id" VARCHAR(32) NOT NULL,
    "status" "ConnectIqActivityStatus" NOT NULL DEFAULT 'receiving',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "utc_offset_sec" INTEGER NOT NULL,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "timer_seconds" DOUBLE PRECISION NOT NULL,
    "avg_heart_rate" INTEGER,
    "max_heart_rate" INTEGER,
    "laps" JSONB NOT NULL,
    "pauses" JSONB NOT NULL,
    "part_count" INTEGER NOT NULL,
    "resolution" VARCHAR(16),
    "workout_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connect_iq_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_iq_activity_parts" (
    "activity_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connect_iq_activity_parts_pkey" PRIMARY KEY ("activity_id","seq")
);

-- CreateIndex
CREATE INDEX "connect_iq_activities_user_id_status_started_at_idx" ON "connect_iq_activities"("user_id", "status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "connect_iq_activities_user_id_client_id_key" ON "connect_iq_activities"("user_id", "client_id");

-- AddForeignKey
ALTER TABLE "connect_iq_activities" ADD CONSTRAINT "connect_iq_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_iq_activities" ADD CONSTRAINT "connect_iq_activities_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "connect_iq_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_iq_activity_parts" ADD CONSTRAINT "connect_iq_activity_parts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "connect_iq_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

