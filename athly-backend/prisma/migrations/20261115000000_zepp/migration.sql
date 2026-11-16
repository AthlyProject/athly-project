-- CreateTable
CREATE TABLE "ZeppConnection" (
    "userId" TEXT NOT NULL,
    "zeppUserId" TEXT,
    "tokens" TEXT,
    "expiresAt" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "stateHash" TEXT,
    "stateExpiresAt" TIMESTAMP(3),
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "syncHash" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "ZeppConnection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ZeppWorkoutMapping" (
    "id" SERIAL NOT NULL,
    "workoutId" TEXT NOT NULL,

    CONSTRAINT "ZeppWorkoutMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZeppActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "fit" BYTEA,
    "summary" JSONB,
    "resolution" TEXT,
    "workoutId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZeppActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZeppConnection_zeppUserId_key" ON "ZeppConnection"("zeppUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ZeppConnection_stateHash_key" ON "ZeppConnection"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "ZeppWorkoutMapping_workoutId_key" ON "ZeppWorkoutMapping"("workoutId");

-- CreateIndex
CREATE INDEX "ZeppActivity_status_nextAttemptAt_idx" ON "ZeppActivity"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ZeppActivity_userId_summaryId_key" ON "ZeppActivity"("userId", "summaryId");

-- AddForeignKey
ALTER TABLE "ZeppConnection" ADD CONSTRAINT "ZeppConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZeppActivity" ADD CONSTRAINT "ZeppActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
