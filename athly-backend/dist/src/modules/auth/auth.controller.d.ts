import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterUserInput } from './dto/register-user.input';
import { AuthPayload } from './dto/auth.payload';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(input: RegisterUserInput): Promise<AuthPayload>;
    login(input: LoginInput): Promise<AuthPayload>;
}
