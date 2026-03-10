"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./database/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const workouts_module_1 = require("./modules/workouts/workouts.module");
const integrations_module_1 = require("./modules/integrations/integrations.module");
const equipments_module_1 = require("./modules/equipments/equipments.module");
const weekly_goals_module_1 = require("./modules/weekly-goals/weekly-goals.module");
const training_plans_module_1 = require("./modules/training-plans/training-plans.module");
const ai_planner_module_1 = require("./modules/ai-planner/ai-planner.module");
const strava_module_1 = require("./modules/strava/strava.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            workouts_module_1.WorkoutsModule,
            integrations_module_1.IntegrationsModule,
            equipments_module_1.EquipmentsModule,
            weekly_goals_module_1.WeeklyGoalsModule,
            training_plans_module_1.TrainingPlansModule,
            ai_planner_module_1.AiPlannerModule,
            strava_module_1.StravaModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map