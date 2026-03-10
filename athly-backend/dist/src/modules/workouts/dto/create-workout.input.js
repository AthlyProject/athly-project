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
exports.CreateWorkoutInput = void 0;
const openapi = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const workout_update_input_1 = require("./workout-update-input");
class CreateWorkoutInput {
    date;
    trainingPlanId;
    weeklyGoalId;
    sportType;
    title;
    description;
    blocks;
    status;
    intensity;
    static _OPENAPI_METADATA_FACTORY() {
        return { date: { required: true, type: () => String }, trainingPlanId: { required: true, type: () => String }, weeklyGoalId: { required: false, type: () => String }, sportType: { required: true, type: () => Object }, title: { required: true, type: () => String }, description: { required: false, type: () => String }, blocks: { required: false, type: () => [require("./workout-update-input").WorkoutBlockInput] }, status: { required: true, type: () => Object }, intensity: { required: false, type: () => Number, minimum: 1, maximum: 10 } };
    }
}
exports.CreateWorkoutInput = CreateWorkoutInput;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "trainingPlanId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "weeklyGoalId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SportType),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "sportType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => workout_update_input_1.WorkoutBlockInput),
    __metadata("design:type", Array)
], CreateWorkoutInput.prototype, "blocks", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.WorkoutStatus),
    __metadata("design:type", String)
], CreateWorkoutInput.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], CreateWorkoutInput.prototype, "intensity", void 0);
//# sourceMappingURL=create-workout.input.js.map