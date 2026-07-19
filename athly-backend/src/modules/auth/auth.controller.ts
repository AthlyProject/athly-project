import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { AuthPayload } from './dto/auth-payload.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: AuthPayload })
  async register(@Body() input: RegisterUserDto): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Post('login')
  @ApiOkResponse({ type: AuthPayload })
  async login(@Body() input: LoginDto): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }

  @Post('refresh')
  @ApiOkResponse({ schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } } })
  async refresh(@Body() input: RefreshTokenDto) {
    return this.authService.refreshSession(input.refreshToken);
  }

  @Post('google')
  @ApiOkResponse({ type: AuthPayload })
  async google(@Body() input: GoogleLoginDto): Promise<AuthPayload> {
    return this.authService.loginWithGoogle(input.idToken);
  }

  @Post('apple')
  @ApiOkResponse({ type: AuthPayload })
  async apple(@Body() input: AppleLoginDto): Promise<AuthPayload> {
    return this.authService.loginWithApple(input.identityToken, input.fullName);
  }
}
