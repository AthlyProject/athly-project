import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';
import { RegisterUserInput } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterUserInput) {
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
