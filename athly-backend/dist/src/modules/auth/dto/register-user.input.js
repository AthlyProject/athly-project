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
exports.RegisterUserInput = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class RegisterUserInput {
    email;
    userName;
    name;
    password;
    confirmPassword;
    dateOfBirth;
    weight;
    height;
    static _OPENAPI_METADATA_FACTORY() {
        return { email: { required: true, type: () => String, format: "email" }, userName: { required: true, type: () => String, minLength: 3, pattern: "/^[a-zA-Z0-9_-]+$/" }, name: { required: true, type: () => String, minLength: 2 }, password: { required: true, type: () => String, minLength: 8, pattern: "/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/" }, confirmPassword: { required: true, type: () => String }, dateOfBirth: { required: true, type: () => String }, weight: { required: true, type: () => Number, minimum: 0 }, height: { required: true, type: () => Number, minimum: 0 } };
    }
}
exports.RegisterUserInput = RegisterUserInput;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email inválido' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Email é obrigatório' }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Username é obrigatório' }),
    (0, class_validator_1.MinLength)(3, { message: 'Username deve ter no mínimo 3 caracteres' }),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9_-]+$/, {
        message: 'Username deve conter apenas letras, números, _ e -',
    }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "userName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Nome é obrigatório' }),
    (0, class_validator_1.MinLength)(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Senha é obrigatória' }),
    (0, class_validator_1.MinLength)(8, { message: 'Senha deve ter no mínimo 8 caracteres' }),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Senha deve conter letras maiúsculas, minúsculas e números',
    }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Confirmação de senha é obrigatória' }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "confirmPassword", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'Data de nascimento inválida' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Data de nascimento é obrigatória' }),
    __metadata("design:type", String)
], RegisterUserInput.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'Peso deve ser um número' }),
    (0, class_validator_1.Min)(0, { message: 'Peso deve ser positivo' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Peso é obrigatório' }),
    __metadata("design:type", Number)
], RegisterUserInput.prototype, "weight", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'Altura deve ser um número' }),
    (0, class_validator_1.Min)(0, { message: 'Altura deve ser positiva' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Altura é obrigatória' }),
    __metadata("design:type", Number)
], RegisterUserInput.prototype, "height", void 0);
//# sourceMappingURL=register-user.input.js.map