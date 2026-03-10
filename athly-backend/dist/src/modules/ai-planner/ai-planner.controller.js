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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ai_planner_service_1 = require("./ai-planner.service");
const plan_next_week_input_1 = require("./dto/plan-next-week.input");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
const ai_planner_result_model_1 = require("./models/ai-planner-result.model");
let AiPlannerController = class AiPlannerController {
    aiPlannerService;
    constructor(aiPlannerService) {
        this.aiPlannerService = aiPlannerService;
    }
    planNextWeek(user, input) {
        return this.aiPlannerService.planNextWeek(user.id, input);
    }
};
exports.AiPlannerController = AiPlannerController;
__decorate([
    (0, common_1.Post)('plan-next-week'),
    (0, swagger_1.ApiOkResponse)({ type: ai_planner_result_model_1.AiPlannerResultModel }),
    openapi.ApiResponse({ status: 201, type: require("./models/ai-planner-result.model").AiPlannerResultModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, plan_next_week_input_1.PlanNextWeekInput]),
    __metadata("design:returntype", Promise)
], AiPlannerController.prototype, "planNextWeek", null);
exports.AiPlannerController = AiPlannerController = __decorate([
    (0, swagger_1.ApiTags)('ai-planner'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('ai-planner'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ai_planner_service_1.AiPlannerService])
], AiPlannerController);
//# sourceMappingURL=ai-planner.controller.js.map