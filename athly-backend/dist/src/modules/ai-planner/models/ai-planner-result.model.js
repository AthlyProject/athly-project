"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerResultModel = void 0;
const swagger_1 = require("@nestjs/swagger");
const training_plan_model_1 = require("../../training-plans/models/training-plan.model");
const weekly_goal_model_1 = require("../../weekly-goals/models/weekly-goal.model");
const workout_model_1 = require("../../workouts/models/workout.model");
class AiPlannerResultModel {
    trainingPlan;
    weeklyGoal;
    workouts;
    analysis;
    isAssessment;
}
exports.AiPlannerResultModel = AiPlannerResultModel;
__decorate([
    (0, swagger_1.ApiProperty)({ type: training_plan_model_1.TrainingPlanModel }),
    __metadata("design:type", Object)
], AiPlannerResultModel.prototype, "trainingPlan", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: weekly_goal_model_1.WeeklyGoalModel }),
    __metadata("design:type", weekly_goal_model_1.WeeklyGoalModel)
], AiPlannerResultModel.prototype, "weeklyGoal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [workout_model_1.WorkoutModel] }),
    __metadata("design:type", Array)
], AiPlannerResultModel.prototype, "workouts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], AiPlannerResultModel.prototype, "analysis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AiPlannerResultModel.prototype, "isAssessment", void 0);
//# sourceMappingURL=ai-planner-result.model.js.map