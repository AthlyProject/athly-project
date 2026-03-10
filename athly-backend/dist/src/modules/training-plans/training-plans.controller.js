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
exports.TrainingPlansController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const training_plans_service_1 = require("./training-plans.service");
const create_training_plan_dto_1 = require("./dto/create-training-plan.dto");
const update_training_plan_dto_1 = require("./dto/update-training-plan.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
const training_plan_model_1 = require("./models/training-plan.model");
let TrainingPlansController = class TrainingPlansController {
    trainingPlansService;
    constructor(trainingPlansService) {
        this.trainingPlansService = trainingPlansService;
    }
    getMyTrainingPlan(user) {
        return this.trainingPlansService.getMyTrainingPlan(user.id);
    }
    getTrainingPlanById(user, id) {
        return this.trainingPlansService.getTrainingPlanById(user.id, id);
    }
    createTrainingPlan(user, input) {
        return this.trainingPlansService.createTrainingPlan(user.id, input);
    }
    updateTrainingPlan(user, id, input) {
        return this.trainingPlansService.updateTrainingPlan(user.id, id, input);
    }
    deleteTrainingPlan(user, id) {
        return this.trainingPlansService.deleteTrainingPlan(user.id, id);
    }
};
exports.TrainingPlansController = TrainingPlansController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOkResponse)({ type: training_plan_model_1.TrainingPlanModel }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", Promise)
], TrainingPlansController.prototype, "getMyTrainingPlan", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOkResponse)({ type: training_plan_model_1.TrainingPlanModel }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], TrainingPlansController.prototype, "getTrainingPlanById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiCreatedResponse)({ type: training_plan_model_1.TrainingPlanModel }),
    openapi.ApiResponse({ status: 201, type: require("./models/training-plan.model").TrainingPlanModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, create_training_plan_dto_1.CreateTrainingPlanInput]),
    __metadata("design:returntype", Promise)
], TrainingPlansController.prototype, "createTrainingPlan", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOkResponse)({ type: training_plan_model_1.TrainingPlanModel }),
    openapi.ApiResponse({ status: 200, type: require("./models/training-plan.model").TrainingPlanModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String, update_training_plan_dto_1.UpdateTrainingPlanInput]),
    __metadata("design:returntype", Promise)
], TrainingPlansController.prototype, "updateTrainingPlan", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOkResponse)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], TrainingPlansController.prototype, "deleteTrainingPlan", null);
exports.TrainingPlansController = TrainingPlansController = __decorate([
    (0, swagger_1.ApiTags)('training-plans'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('training-plans'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [training_plans_service_1.TrainingPlansService])
], TrainingPlansController);
//# sourceMappingURL=training-plans.controller.js.map