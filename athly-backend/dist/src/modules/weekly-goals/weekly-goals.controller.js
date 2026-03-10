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
exports.WeeklyGoalsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const weekly_goals_service_1 = require("./weekly-goals.service");
const create_weekly_goal_dto_1 = require("./dto/create-weekly-goal.dto");
const update_weekly_goal_dto_1 = require("./dto/update-weekly-goal.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
const weekly_goal_model_1 = require("./models/weekly-goal.model");
let WeeklyGoalsController = class WeeklyGoalsController {
    weeklyGoalsService;
    constructor(weeklyGoalsService) {
        this.weeklyGoalsService = weeklyGoalsService;
    }
    getWeeklyGoalsByTrainingPlan(user, trainingPlanId) {
        return this.weeklyGoalsService.getWeeklyGoalsByTrainingPlan(user.id, trainingPlanId);
    }
    getWeeklyGoalById(user, uuid) {
        return this.weeklyGoalsService.getWeeklyGoalById(user.id, uuid);
    }
    createWeeklyGoal(user, input) {
        return this.weeklyGoalsService.createWeeklyGoal(user.id, input);
    }
    updateWeeklyGoal(user, uuid, input) {
        return this.weeklyGoalsService.updateWeeklyGoal(user.id, uuid, input);
    }
    deleteWeeklyGoal(user, uuid) {
        return this.weeklyGoalsService.deleteWeeklyGoal(user.id, uuid);
    }
};
exports.WeeklyGoalsController = WeeklyGoalsController;
__decorate([
    (0, common_1.Get)('training-plan/:trainingPlanId'),
    (0, swagger_1.ApiOkResponse)({ type: weekly_goal_model_1.WeeklyGoalModel, isArray: true }),
    openapi.ApiResponse({ status: 200, type: [require("./models/weekly-goal.model").WeeklyGoalModel] }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('trainingPlanId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], WeeklyGoalsController.prototype, "getWeeklyGoalsByTrainingPlan", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, swagger_1.ApiOkResponse)({ type: weekly_goal_model_1.WeeklyGoalModel }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], WeeklyGoalsController.prototype, "getWeeklyGoalById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiCreatedResponse)({ type: weekly_goal_model_1.WeeklyGoalModel }),
    openapi.ApiResponse({ status: 201, type: require("./models/weekly-goal.model").WeeklyGoalModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, create_weekly_goal_dto_1.CreateWeeklyGoalInput]),
    __metadata("design:returntype", Promise)
], WeeklyGoalsController.prototype, "createWeeklyGoal", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    (0, swagger_1.ApiOkResponse)({ type: weekly_goal_model_1.WeeklyGoalModel }),
    openapi.ApiResponse({ status: 200, type: require("./models/weekly-goal.model").WeeklyGoalModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('uuid')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String, update_weekly_goal_dto_1.UpdateWeeklyGoalInput]),
    __metadata("design:returntype", Promise)
], WeeklyGoalsController.prototype, "updateWeeklyGoal", null);
__decorate([
    (0, common_1.Delete)(':uuid'),
    (0, swagger_1.ApiOkResponse)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], WeeklyGoalsController.prototype, "deleteWeeklyGoal", null);
exports.WeeklyGoalsController = WeeklyGoalsController = __decorate([
    (0, swagger_1.ApiTags)('weekly-goals'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('weekly-goals'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [weekly_goals_service_1.WeeklyGoalsService])
], WeeklyGoalsController);
//# sourceMappingURL=weekly-goals.controller.js.map