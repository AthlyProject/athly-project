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
exports.PlanNextWeekInput = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class PlanNextWeekInput {
    numberOfRuns;
    weekStartDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { numberOfRuns: { required: false, type: () => Number, minimum: 1, maximum: 30 }, weekStartDate: { required: false, type: () => String } };
    }
}
exports.PlanNextWeekInput = PlanNextWeekInput;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(30),
    __metadata("design:type", Number)
], PlanNextWeekInput.prototype, "numberOfRuns", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PlanNextWeekInput.prototype, "weekStartDate", void 0);
//# sourceMappingURL=plan-next-week.input.js.map