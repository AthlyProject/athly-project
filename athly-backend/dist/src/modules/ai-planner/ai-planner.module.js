"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerModule = void 0;
const common_1 = require("@nestjs/common");
const ai_planner_controller_1 = require("./ai-planner.controller");
const ai_planner_service_1 = require("./ai-planner.service");
const strava_service_1 = require("./strava.service");
const gemini_service_1 = require("./gemini.service");
const integrations_module_1 = require("../integrations/integrations.module");
let AiPlannerModule = class AiPlannerModule {
};
exports.AiPlannerModule = AiPlannerModule;
exports.AiPlannerModule = AiPlannerModule = __decorate([
    (0, common_1.Module)({
        imports: [integrations_module_1.IntegrationsModule],
        controllers: [ai_planner_controller_1.AiPlannerController],
        providers: [ai_planner_service_1.AiPlannerService, strava_service_1.StravaService, gemini_service_1.GeminiService],
    })
], AiPlannerModule);
//# sourceMappingURL=ai-planner.module.js.map