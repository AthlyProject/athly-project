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
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from '../email/email.service';

type SocialProvider = 'google' | 'apple';

interface SocialIdentity {
  provider: SocialProvider;
  providerUserId: string;
  email?: string | null;
  name?: string | null;
}

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(input: RegisterUserDto) {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('As senhas não coincidem');
    }

    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashedPassword,
        dateOfBirth: new Date(input.dateOfBirth),
        weight: input.weight,
        height: input.height,
      },
    });

    // Fire-and-forget welcome email
    this.emailService
      .sendWelcomeEmail(user.email, user.name)
      .catch((err: Error) =>
        console.error(`[Auth] Failed to send welcome email to ${user.email}:`, err.message),
      );

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

    // Conta criada via login social (Apple/Google) não tem senha.
    if (!user.password) {
      throw new UnauthorizedException('Esta conta usa login social. Entre com Apple ou Google.');
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

  async refreshSession(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expirado');
    }

    await this.prisma.session.delete({ where: { id: session.id } });

    const newAccessToken = this.signAccessToken(session.user);
    const newRefreshToken = await this.createSession(session.user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async loginWithGoogle(idToken: string) {
    const audience = this.config.get<string>('GOOGLE_IOS_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException('Login com Google não está configurado');
    }

    let sub: string | undefined;
    let email: string | undefined;
    let name: string | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      sub = payload?.sub;
      email = payload?.email;
      name = payload?.name;
    } catch {
      throw new UnauthorizedException('Token do Google inválido');
    }

    if (!sub) {
      throw new UnauthorizedException('Token do Google inválido');
    }

    const user = await this.resolveSocialUser({
      provider: 'google',
      providerUserId: sub,
      email,
      name,
    });

    return this.issueSession(user);
  }

  async loginWithApple(identityToken: string, fullName?: string) {
    const audience = this.config.get<string>('APPLE_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException('Login com Apple não está configurado');
    }

    let payload: Awaited<ReturnType<typeof appleSignin.verifyIdToken>>;
    try {
      payload = await appleSignin.verifyIdToken(identityToken, { audience });
    } catch {
      throw new UnauthorizedException('Token da Apple inválido');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Token da Apple inválido');
    }

    const user = await this.resolveSocialUser({
      provider: 'apple',
      providerUserId: payload.sub,
      email: payload.email,
      name: fullName,
    });

    return this.issueSession(user);
  }

  /** Vincula uma conta Apple ao usuário autenticado (a partir do identity token). */
  async linkApple(userId: string, identityToken: string) {
    const audience = this.config.get<string>('APPLE_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException('Login com Apple não está configurado');
    }

    let sub: string | undefined;
    try {
      const payload = await appleSignin.verifyIdToken(identityToken, { audience });
      sub = payload?.sub;
    } catch {
      throw new UnauthorizedException('Token da Apple inválido');
    }
    if (!sub) {
      throw new UnauthorizedException('Token da Apple inválido');
    }

    const existing = await this.prisma.user.findFirst({
      where: { appleUserId: sub },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Esta conta Apple já está vinculada a outro usuário.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { appleUserId: sub },
    });
    return this.usersService.toUserModel(updated);
  }

  /** Vincula uma conta Google ao usuário autenticado (a partir do id_token). */
  async linkGoogle(userId: string, idToken: string) {
    const audience = this.config.get<string>('GOOGLE_IOS_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException('Login com Google não está configurado');
    }

    let sub: string | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      sub = ticket.getPayload()?.sub;
    } catch {
      throw new UnauthorizedException('Token do Google inválido');
    }
    if (!sub) {
      throw new UnauthorizedException('Token do Google inválido');
    }

    const existing = await this.prisma.user.findFirst({
      where: { googleUserId: sub },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Esta conta Google já está vinculada a outro usuário.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { googleUserId: sub },
    });
    return this.usersService.toUserModel(updated);
  }

  /**
   * Desvincula um provedor social. Bloqueado quando removeria a última credencial de acesso
   * (conta sem senha e sem o outro provedor vinculado).
   */
  async unlinkApple(userId: string) {
    const user = await this.requireUnlinkable(userId, 'google');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { appleUserId: null },
    });
    return this.usersService.toUserModel(updated);
  }

  async unlinkGoogle(userId: string) {
    const user = await this.requireUnlinkable(userId, 'apple');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { googleUserId: null },
    });
    return this.usersService.toUserModel(updated);
  }

  /** Garante que sobra ao menos uma credencial (senha ou o outro provedor) após desvincular. */
  private async requireUnlinkable(userId: string, otherProvider: SocialProvider): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const otherLinked = otherProvider === 'google' ? !!user.googleUserId : !!user.appleUserId;
    if (!user.password && !otherLinked) {
      throw new BadRequestException(
        'Defina uma senha ou vincule outra conta antes de desvincular esta.',
      );
    }
    return user;
  }

  /**
   * Resolve o usuário de um login social, na ordem: (1) já vinculado pelo id do provedor;
   * (2) mesmo email → vincula o provedor à conta existente (link-by-email); (3) cria uma
   * conta nova sem senha, com username único e onboarding pendente.
   */
  private async resolveSocialUser(identity: SocialIdentity): Promise<User> {
    // Objeto tipado com o id do provedor (evita chave computada que quebra os tipos do Prisma).
    const providerLink =
      identity.provider === 'google'
        ? { googleUserId: identity.providerUserId }
        : { appleUserId: identity.providerUserId };

    const byProvider = await this.prisma.user.findFirst({ where: providerLink });
    if (byProvider) {
      return byProvider;
    }

    if (identity.email) {
      const byEmail = await this.usersService.findByEmail(identity.email);
      if (byEmail) {
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: providerLink,
        });
      }
    }

    if (!identity.email) {
      // Sem email (Apple em re-autorizações) e sem conta vinculada: não há como criar/associar.
      throw new UnauthorizedException('Não foi possível identificar a conta. Tente novamente.');
    }

    const username = await this.generateUniqueUsername(identity.email);
    const user = await this.prisma.user.create({
      data: {
        email: identity.email,
        username,
        name: identity.name?.trim() || identity.email.split('@')[0] || 'Atleta',
        password: null,
        ...providerLink,
      },
    });

    this.emailService
      .sendWelcomeEmail(user.email, user.name)
      .catch((err: Error) =>
        console.error(`[Auth] Failed to send welcome email to ${user.email}:`, err.message),
      );

    return user;
  }

  /** Gera um username único a partir do local-part do email, com sufixo numérico em colisão. */
  private async generateUniqueUsername(email: string): Promise<string> {
    const base =
      email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 20) || 'atleta';

    let candidate = base;
    let suffix = 0;
    // Loop limitado: acrescenta sufixo até achar um username livre.
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
  }

  private async issueSession(user: User) {
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
