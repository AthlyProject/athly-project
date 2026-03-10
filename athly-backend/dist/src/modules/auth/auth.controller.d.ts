import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.dto';
import { RegisterUserInput } from './dto/register-user.dto';
import { AuthPayload } from './dto/auth-payload.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(input: RegisterUserInput): Promise<AuthPayload>;
    login(input: LoginInput): Promise<AuthPayload>;
}
