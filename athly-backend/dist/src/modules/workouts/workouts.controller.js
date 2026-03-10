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
exports.WorkoutsController = void 0;
const common_1 = require("@nestjs/common");
const workouts_service_1 = require("./workouts.service");
const submit_workout_feedback_input_1 = require("./dto/submit-workout-feedback.input");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
const workout_update_input_1 = require("./dto/workout-update-input");
const create_workout_input_1 = require("./dto/create-workout.input");
let WorkoutsController = class WorkoutsController {
    workoutsService;
    constructor(workoutsService) {
        this.workoutsService = workoutsService;
    }
    todayWorkout(user) {
        return this.workoutsService.getTodayWorkout(user.id);
    }
    workoutHistory(user) {
        return this.workoutsService.getWorkoutHistory(user.id);
    }
    createWorkout(user, input) {
        return this.workoutsService.createWorkout(user.id, input);
    }
    workoutsByTrainingPlan(user, trainingPlanId) {
        return this.workoutsService.getWorkoutsByTrainingPlan(user.id, trainingPlanId);
    }
    workout(user, id) {
        return this.workoutsService.getWorkoutById(user.id, id);
    }
    submitWorkoutFeedback(user, workoutId, input) {
        return this.workoutsService.submitWorkoutFeedback(user.id, workoutId, input);
    }
    completeWorkout(user, workoutId) {
        return this.workoutsService.completeWorkout(user.id, workoutId);
    }
    skipWorkout(user, workoutId) {
        return this.workoutsService.skipWorkout(user.id, workoutId);
    }
    updateWorkout(workoutId, input) {
        return this.workoutsService.updateWorkout(workoutId, input);
    }
};
exports.WorkoutsController = WorkoutsController;
__decorate([
    (0, common_1.Get)('today'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "todayWorkout", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "workoutHistory", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, create_workout_input_1.CreateWorkoutInput]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "createWorkout", null);
__decorate([
    (0, common_1.Get)('training-plan/:trainingPlanId'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('trainingPlanId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "workoutsByTrainingPlan", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "workout", null);
__decorate([
    (0, common_1.Post)(':workoutId/feedback'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('workoutId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String, submit_workout_feedback_input_1.SubmitWorkoutFeedbackInput]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "submitWorkoutFeedback", null);
__decorate([
    (0, common_1.Patch)(':workoutId/complete'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('workoutId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "completeWorkout", null);
__decorate([
    (0, common_1.Patch)(':workoutId/skip'),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('workoutId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "skipWorkout", null);
__decorate([
    (0, common_1.Put)(':workoutId'),
    __param(0, (0, common_1.Param)('workoutId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, workout_update_input_1.UpdateWorkoutInput]),
    __metadata("design:returntype", void 0)
], WorkoutsController.prototype, "updateWorkout", null);
exports.WorkoutsController = WorkoutsController = __decorate([
    (0, common_1.Controller)('workouts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [workouts_service_1.WorkoutsService])
], WorkoutsController);
//# sourceMappingURL=workouts.controller.js.map