-- DropForeignKey
ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "assessments_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "assessments";

-- AlterTable: move assessment profile answers onto the user
ALTER TABLE "users" ADD COLUMN     "fitness_level" TEXT,
ADD COLUMN     "comfort_pace_seconds" INTEGER,
ADD COLUMN     "resting_heart_rate" INTEGER,
ADD COLUMN     "max_heart_rate" INTEGER;
