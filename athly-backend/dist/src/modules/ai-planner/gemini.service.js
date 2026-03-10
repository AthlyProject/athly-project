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
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const planner_prompt_1 = require("./prompts/planner-prompt");
let GeminiService = class GeminiService {
    configService;
    modelName = 'gemini-2.5-flash';
    constructor(configService) {
        this.configService = configService;
    }
    getModel() {
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (!apiKey) {
            throw new common_1.InternalServerErrorException('GEMINI_API_KEY is not configured.');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: { responseMimeType: 'application/json' },
        });
    }
    async generatePlan(input) {
        const model = this.getModel();
        const prompt = (0, planner_prompt_1.buildPlannerPrompt)(input);
        let responseText;
        try {
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        }
        catch (err) {
            throw new common_1.BadGatewayException(`Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return this.parseAndValidate(responseText);
    }
    async generateAssessmentPlan(weekDates, trainingDays) {
        const model = this.getModel();
        const prompt = (0, planner_prompt_1.buildAssessmentPrompt)(weekDates, trainingDays);
        let responseText;
        try {
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        }
        catch (err) {
            throw new common_1.BadGatewayException(`Gemini AI request failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return this.parseAndValidate(responseText);
    }
    parseAndValidate(responseText) {
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        }
        catch {
            throw new common_1.BadGatewayException('Gemini AI returned an invalid JSON response.');
        }
        if (!parsed.analysis || !Array.isArray(parsed.weekPlan)) {
            throw new common_1.BadGatewayException("Gemini AI response is missing required fields: 'analysis' or 'weekPlan'.");
        }
        if (parsed.weekPlan.length !== 7) {
            throw new common_1.BadGatewayException(`Gemini AI returned ${parsed.weekPlan.length} workout days instead of 7.`);
        }
        return parsed;
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map