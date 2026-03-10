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
exports.WorkoutFeedbackModel = exports.TrainingPlanModel = exports.WeekModel = exports.WorkoutModel = exports.WorkoutBlock = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class WorkoutBlock {
    type;
    duration;
    distance;
    targetPace;
    instructions;
}
exports.WorkoutBlock = WorkoutBlock;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WorkoutBlock.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], WorkoutBlock.prototype, "duration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], WorkoutBlock.prototype, "distance", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], WorkoutBlock.prototype, "targetPace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], WorkoutBlock.prototype, "instructions", void 0);
class WorkoutModel {
    id;
    date;
    sportType;
    title;
    description;
    blocks;
    status;
    trainingPlanId;
    weeklyGoalId;
    intensity;
    stravaActivityId;
}
exports.WorkoutModel = WorkoutModel;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SportType }),
    __metadata("design:type", String)
], WorkoutModel.prototype, "sportType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [WorkoutBlock] }),
    __metadata("design:type", Array)
], WorkoutModel.prototype, "blocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.WorkoutStatus }),
    __metadata("design:type", String)
], WorkoutModel.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "trainingPlanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], WorkoutModel.prototype, "weeklyGoalId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], WorkoutModel.prototype, "intensity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], WorkoutModel.prototype, "stravaActivityId", void 0);
class WeekModel {
    number;
    workouts;
}
exports.WeekModel = WeekModel;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], WeekModel.prototype, "number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [WorkoutModel] }),
    __metadata("design:type", Array)
], WeekModel.prototype, "workouts", void 0);
class TrainingPlanModel {
    id;
    startDate;
    weeks;
}
exports.TrainingPlanModel = TrainingPlanModel;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TrainingPlanModel.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TrainingPlanModel.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [WeekModel] }),
    __metadata("design:type", Array)
], TrainingPlanModel.prototype, "weeks", void 0);
class WorkoutFeedbackModel {
    workoutId;
    completed;
    effort;
    fatigue;
}
exports.WorkoutFeedbackModel = WorkoutFeedbackModel;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WorkoutFeedbackModel.prototype, "workoutId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], WorkoutFeedbackModel.prototype, "completed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], WorkoutFeedbackModel.prototype, "effort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], WorkoutFeedbackModel.prototype, "fatigue", void 0);
//# sourceMappingURL=workout.model.js.map