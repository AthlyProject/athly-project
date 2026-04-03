import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import { StravaService } from '../strava/strava.service';
import { IntegrationsService } from '../integrations/integrations.service';

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly stravaService: StravaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async register(input: RegisterUserDto) {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('As senhas não coincidem');
    }

    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: input.userName },
    });
    if (existingUsername) {
      throw new ConflictException('Username já está em uso');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.userName,
        name: input.name,
        password: hashedPassword,
        dateOfBirth: new Date(input.dateOfBirth),
        weight: input.weight,
        height: input.height,
      },
    });

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.createSession(user);

    return {
      user: this.usersService.toUserModel(user),
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.createSession(user);

    return {
      user: this.usersService.toUserModel(user),
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.usersService.toUserModel(user);
  }

  // ─── Strava Auth ────────────────────────────────────────────────────────────

  getStravaAuthUrl(): string {
    const clientId = this.config.get<string>('STRAVA_CLIENT_ID');
    const redirectUri = this.config.get<string>('STRAVA_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new InternalServerErrorException('Strava OAuth is not configured.');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      approval_prompt: 'auto',
      scope: 'activity:read_all',
    });
    return `https://www.strava.com/oauth/authorize?${params}`;
  }

  async stravaLogin(code: string) {
    const clientId = this.config.get<string>('STRAVA_CLIENT_ID');
    const clientSecret = this.config.get<string>('STRAVA_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Strava OAuth is not configured.');
    }

    // 1. Exchange sequence
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange Strava authorization code.');
    }

    const tokens = (await response.json()) as StravaTokenResponse;
    const athleteId = tokens.athlete?.id?.toString();

    if (!athleteId) {
      throw new UnauthorizedException('Strava payload did not contain athlete id.');
    }

    // 2. See if Integration exists
    const existingIntegration = await this.prisma.integration.findFirst({
      where: { type: 'strava', stravaAthleteId: athleteId },
    });

    let userId: string;

    if (existingIntegration) {
      userId = existingIntegration.userId;
      // Update tokens
      await this.prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          connected: true,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(tokens.expires_at * 1000),
          scope: 'activity:read_all',
        },
      });
    } else {
      // 3. Register flow
      // Generate secure random info for the core required fields
      const randomSuffix = randomBytes(4).toString('hex');
      const email = `strava_${athleteId}_${randomSuffix}@athly.app`;
      const username = `strava_${athleteId}_${randomSuffix}`;
      const randomPassword = randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Create User and Integration in one transaction
      const newUser = await this.prisma.user.create({
        data: {
          email,
          username,
          name: 'Atleta Strava', // Could fetch from Strava API if we had the athlete details endpoint
          password: hashedPassword,
          integrations: {
            create: {
              name: 'Strava',
              icon: '🏃',
              type: 'strava',
              connected: true,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              tokenExpiresAt: new Date(tokens.expires_at * 1000),
              stravaAthleteId: athleteId,
              scope: 'activity:read_all',
            },
          },
        },
      });
      userId = newUser.id;
    }

    // 4. Fetch User, create session, return
    const userRecord = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userRecord) {
      throw new InternalServerErrorException('Error creating/querying Strava user');
    }

    const accessToken = this.signAccessToken(userRecord);
    const refreshToken = await this.createSession(userRecord);

    // Fire-and-forget sync
    this.stravaService
      .syncActivities(userId, tokens.access_token)
      .catch((err: Error) =>
        console.error(`[Strava Auth] Background sync failed for user ${userId}:`, err.message),
      );

    return {
      user: this.usersService.toUserModel(userRecord),
      accessToken,
      refreshToken,
    };
  }

  private signAccessToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }

  private async createSession(user: User) {
    const refreshToken = `${randomUUID()}-${randomBytes(24).toString('hex')}`;
    const expiresIn = this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d');
    const expiresAt = this.calculateExpiry(expiresIn);

    await this.prisma.session.create({
      data: {
        refreshToken,
        expiresAt,
        userId: user.id,
      },
    });

    return refreshToken;
  }

  private calculateExpiry(value: string) {
    const now = new Date();
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      now.setDate(now.getDate() + 7);
      return now;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        now.setSeconds(now.getSeconds() + amount);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + amount);
        break;
      case 'h':
        now.setHours(now.getHours() + amount);
        break;
      case 'd':
      default:
        now.setDate(now.getDate() + amount);
        break;
    }
    return now;
  }
}
