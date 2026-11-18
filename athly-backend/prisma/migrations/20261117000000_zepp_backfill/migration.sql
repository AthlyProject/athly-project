ALTER TABLE "ZeppConnection"
ADD COLUMN "backfillRequestedAt" TIMESTAMP(3),
ADD COLUMN "backfillRequestId" TEXT,
ADD COLUMN "backfillError" TEXT;
