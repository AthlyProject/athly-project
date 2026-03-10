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
exports.IntegrationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const integrations_service_1 = require("./integrations.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
const strava_callback_dto_1 = require("./dto/strava-callback.dto");
const integration_model_1 = require("./models/integration.model");
let IntegrationsController = class IntegrationsController {
    integrationsService;
    constructor(integrationsService) {
        this.integrationsService = integrationsService;
    }
    integrations(user) {
        return this.integrationsService.getIntegrations(user.id);
    }
    connectIntegration(user, integrationId) {
        return this.integrationsService.connectIntegration(user.id, integrationId);
    }
    disconnectIntegration(user, integrationId) {
        return this.integrationsService.disconnectIntegration(user.id, integrationId);
    }
    getStravaAuthUrl() {
        return { url: this.integrationsService.getStravaAuthUrl() };
    }
    handleStravaCallback(user, input) {
        return this.integrationsService.handleStravaCallback(user.id, input.code);
    }
    syncStrava(user) {
        return this.integrationsService.syncStravaActivities(user.id);
    }
    disconnectStrava(user) {
        return this.integrationsService.disconnectStrava(user.id);
    }
};
exports.IntegrationsController = IntegrationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOkResponse)({ type: integration_model_1.IntegrationModel, isArray: true }),
    openapi.ApiResponse({ status: 200, type: [require("./models/integration.model").IntegrationModel] }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "integrations", null);
__decorate([
    (0, common_1.Post)(':integrationId/connect'),
    (0, swagger_1.ApiOkResponse)({ type: integration_model_1.IntegrationModel }),
    openapi.ApiResponse({ status: 201, type: require("./models/integration.model").IntegrationModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('integrationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "connectIntegration", null);
__decorate([
    (0, common_1.Delete)(':integrationId/disconnect'),
    (0, swagger_1.ApiOkResponse)({ type: integration_model_1.IntegrationModel }),
    openapi.ApiResponse({ status: 200, type: require("./models/integration.model").IntegrationModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('integrationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectIntegration", null);
__decorate([
    (0, common_1.Get)('strava/auth'),
    (0, swagger_1.ApiOkResponse)({ schema: { type: 'object', properties: { url: { type: 'string' } } } }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], IntegrationsController.prototype, "getStravaAuthUrl", null);
__decorate([
    (0, common_1.Post)('strava/callback'),
    (0, swagger_1.ApiOkResponse)({ type: integration_model_1.IntegrationModel }),
    openapi.ApiResponse({ status: 201, type: require("./models/integration.model").IntegrationModel }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel,
        strava_callback_dto_1.StravaCallbackInput]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "handleStravaCallback", null);
__decorate([
    (0, common_1.Post)('strava/sync'),
    (0, swagger_1.ApiOkResponse)({ schema: { type: 'object', properties: { synced: { type: 'number' } } } }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "syncStrava", null);
__decorate([
    (0, common_1.Post)('strava/disconnect'),
    (0, swagger_1.ApiOkResponse)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", Promise)
], IntegrationsController.prototype, "disconnectStrava", null);
exports.IntegrationsController = IntegrationsController = __decorate([
    (0, swagger_1.ApiTags)('integrations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('integrations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [integrations_service_1.IntegrationsService])
], IntegrationsController);
//# sourceMappingURL=integrations.controller.js.map