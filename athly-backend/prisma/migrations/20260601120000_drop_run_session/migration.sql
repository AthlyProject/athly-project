-- DropForeignKey
ALTER TABLE "run_sessions" DROP CONSTRAINT "run_sessions_user_id_fkey";

-- DropTable
DROP TABLE "run_sessions";
