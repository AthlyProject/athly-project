-- CreateIndex
CREATE UNIQUE INDEX "weekly_goals_training_plan_id_week_start_date_key" ON "weekly_goals"("training_plan_id", "week_start_date");
