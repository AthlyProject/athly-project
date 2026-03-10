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
exports.UpdateWeeklyGoalInput = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class UpdateWeeklyGoalInput {
    weekStartDate;
    weekEndDate;
    status;
    metrics;
    static _OPENAPI_METADATA_FACTORY() {
        return { weekStartDate: { required: false, type: () => String }, weekEndDate: { required: false, type: () => String }, status: { required: false, type: () => Object }, metrics: { required: false, type: () => Object } };
    }
}
exports.UpdateWeeklyGoalInput = UpdateWeeklyGoalInput;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateWeeklyGoalInput.prototype, "weekStartDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateWeeklyGoalInput.prototype, "weekEndDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.WeeklyGoalStatus),
    __metadata("design:type", String)
], UpdateWeeklyGoalInput.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateWeeklyGoalInput.prototype, "metrics", void 0);
//# sourceMappingURL=update-weekly-goal.input.js.map