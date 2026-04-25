-- CreateTable
CREATE TABLE "ai_planner_prompt_logs" (
    "id" TEXT NOT NULL,
    "weekly_goal_id" TEXT NOT NULL,
    "generation_type" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "raw_response" TEXT NOT NULL,
    "parsed_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_planner_prompt_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_planner_prompt_logs_weekly_goal_id_key" ON "ai_planner_prompt_logs"("weekly_goal_id");

-- AddForeignKey
ALTER TABLE "ai_planner_prompt_logs" ADD CONSTRAINT "ai_planner_prompt_logs_weekly_goal_id_fkey" FOREIGN KEY ("weekly_goal_id") REFERENCES "weekly_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
