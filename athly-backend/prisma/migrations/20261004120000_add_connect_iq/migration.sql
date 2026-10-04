-- Relógio Garmin (app Connect IQ): pareamento por código e relógios pareados. Tokens e códigos
-- só como hash. Índice em workouts para o manifesto que o relógio pede a cada abertura.
-- CreateTable
CREATE TABLE "connect_iq_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT,
    "token_issued_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "hardware_id_hash" TEXT,
    "part_number" VARCHAR(32),
    "api_level" VARCHAR(16),
    "app_version" VARCHAR(16),
    "paired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_sync_report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connect_iq_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_iq_pairings" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "poll_token_hash" TEXT NOT NULL,
    "hardware_id_hash" TEXT,
    "part_number" VARCHAR(32),
    "api_level" VARCHAR(16),
    "app_version" VARCHAR(16),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_by_user_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "device_id" TEXT,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connect_iq_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connect_iq_devices_token_hash_key" ON "connect_iq_devices"("token_hash");

-- CreateIndex
CREATE INDEX "connect_iq_devices_user_id_idx" ON "connect_iq_devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "connect_iq_pairings_code_hash_key" ON "connect_iq_pairings"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "connect_iq_pairings_poll_token_hash_key" ON "connect_iq_pairings"("poll_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "connect_iq_pairings_device_id_key" ON "connect_iq_pairings"("device_id");

-- CreateIndex
CREATE INDEX "connect_iq_pairings_expires_at_idx" ON "connect_iq_pairings"("expires_at");

-- CreateIndex
CREATE INDEX "workouts_user_id_date_scheduled_idx" ON "workouts"("user_id", "date_scheduled");

-- AddForeignKey
ALTER TABLE "connect_iq_devices" ADD CONSTRAINT "connect_iq_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_iq_pairings" ADD CONSTRAINT "connect_iq_pairings_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_iq_pairings" ADD CONSTRAINT "connect_iq_pairings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "connect_iq_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

