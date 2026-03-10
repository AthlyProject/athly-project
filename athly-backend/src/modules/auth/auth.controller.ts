import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterUserInput } from './dto/register-user.input';
import { AuthPayload } from './dto/auth.payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: AuthPayload })
  async register(@Body() input: RegisterUserInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Post('login')
  @ApiOkResponse({ type: AuthPayload })
  async login(@Body() input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }
}
