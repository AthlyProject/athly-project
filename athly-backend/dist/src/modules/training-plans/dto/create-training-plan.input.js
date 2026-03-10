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
exports.CreateTrainingPlanInput = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreateTrainingPlanInput {
    startDate;
    objective;
    status;
    targetDate;
    sports;
    autoGenerate;
    static _OPENAPI_METADATA_FACTORY() {
        return { startDate: { required: true, type: () => String }, objective: { required: true, type: () => String }, status: { required: true, type: () => Object }, targetDate: { required: false, type: () => String }, sports: { required: true, type: () => [Object] }, autoGenerate: { required: false, type: () => Boolean } };
    }
}
exports.CreateTrainingPlanInput = CreateTrainingPlanInput;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateTrainingPlanInput.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTrainingPlanInput.prototype, "objective", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TrainingPlanStatus),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTrainingPlanInput.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateTrainingPlanInput.prototype, "targetDate", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.SportType, { each: true }),
    __metadata("design:type", Array)
], CreateTrainingPlanInput.prototype, "sports", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTrainingPlanInput.prototype, "autoGenerate", void 0);
//# sourceMappingURL=create-training-plan.input.js.map