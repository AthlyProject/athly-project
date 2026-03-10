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
exports.EquipmentsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const equipments_service_1 = require("./equipments.service");
const create_equipment_dto_1 = require("./dto/create-equipment.dto");
const update_equipment_dto_1 = require("./dto/update-equipment.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_rest_decorator_1 = require("../auth/decorators/current-user-rest.decorator");
const user_model_1 = require("../users/models/user.model");
let EquipmentsController = class EquipmentsController {
    equipmentsService;
    constructor(equipmentsService) {
        this.equipmentsService = equipmentsService;
    }
    getAllEquipments() {
        return this.equipmentsService.getAllEquipments();
    }
    getUserEquipments(user) {
        return this.equipmentsService.getUserEquipments(user.id);
    }
    getEquipmentById(uuid) {
        return this.equipmentsService.getEquipmentById(uuid);
    }
    createEquipment(input) {
        return this.equipmentsService.createEquipment(input);
    }
    updateEquipment(uuid, input) {
        return this.equipmentsService.updateEquipment(uuid, input);
    }
    deleteEquipment(uuid) {
        return this.equipmentsService.deleteEquipment(uuid);
    }
    addEquipmentToUser(user, equipmentId) {
        return this.equipmentsService.addEquipmentToUser(user.id, equipmentId);
    }
    removeEquipmentFromUser(user, equipmentId) {
        return this.equipmentsService.removeEquipmentFromUser(user.id, equipmentId);
    }
};
exports.EquipmentsController = EquipmentsController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [require("./models/equipment.model").EquipmentModel] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "getAllEquipments", null);
__decorate([
    (0, common_1.Get)('my-equipments'),
    openapi.ApiResponse({ status: 200, type: [require("./models/equipment.model").EquipmentModel] }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "getUserEquipments", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    openapi.ApiResponse({ status: 200, type: require("./models/equipment.model").EquipmentModel }),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "getEquipmentById", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: require("./models/equipment.model").EquipmentModel }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_equipment_dto_1.CreateEquipmentInput]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "createEquipment", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    openapi.ApiResponse({ status: 200, type: require("./models/equipment.model").EquipmentModel }),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_equipment_dto_1.UpdateEquipmentInput]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "updateEquipment", null);
__decorate([
    (0, common_1.Delete)(':uuid'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "deleteEquipment", null);
__decorate([
    (0, common_1.Post)(':equipmentId/add'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('equipmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "addEquipmentToUser", null);
__decorate([
    (0, common_1.Delete)(':equipmentId/remove'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_rest_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('equipmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_model_1.UserModel, String]),
    __metadata("design:returntype", void 0)
], EquipmentsController.prototype, "removeEquipmentFromUser", null);
exports.EquipmentsController = EquipmentsController = __decorate([
    (0, common_1.Controller)('equipments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [equipments_service_1.EquipmentsService])
], EquipmentsController);
//# sourceMappingURL=equipments.controller.js.map