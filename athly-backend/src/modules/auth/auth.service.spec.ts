import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LEGAL_DOCUMENT_VERSIONS } from '../../common/legal/legal-documents';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    passwordResetCode: {
      count: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    user: { update: jest.Mock };
    session: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let usersService: { findByEmail: jest.Mock };
  let emailService: {
    sendPasswordResetEmail: jest.Mock;
    sendSocialOnlyResetEmail: jest.Mock;
  };

  const passwordUser = {
    id: 'user-1',
    email: 'athlete@example.com',
    name: 'Athlete',
    password: 'hashed-current-password',
  };

  const socialOnlyUser = {
    id: 'user-2',
    email: 'social@example.com',
    name: 'Social Athlete',
    password: null,
  };

  beforeEach(() => {
    prisma = {
      passwordResetCode: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'code-1' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    usersService = { findByEmail: jest.fn() };
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendSocialOnlyResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
      {} as JwtService,
      {} as ConfigService,
      emailService as unknown as EmailService,
    );
  });

  describe('forgotPassword', () => {
    it('returns the generic message and sends nothing when the email is not registered', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('missing@example.com');

      expect(result.message).toMatch(/Se este email estiver cadastrado/);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(emailService.sendSocialOnlyResetEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetCode.create).not.toHaveBeenCalled();
    });

    it('sends the social-only notice (not a code) for accounts without a password', async () => {
      usersService.findByEmail.mockResolvedValue(socialOnlyUser);

      const result = await service.forgotPassword(socialOnlyUser.email);

      expect(result.message).toMatch(/Se este email estiver cadastrado/);
      expect(emailService.sendSocialOnlyResetEmail).toHaveBeenCalledWith(
        socialOnlyUser.email,
        socialOnlyUser.name,
      );
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetCode.create).not.toHaveBeenCalled();
    });

    it('invalidates previous codes and emails a fresh code for a password-based account', async () => {
      usersService.findByEmail.mockResolvedValue(passwordUser);

      const result = await service.forgotPassword(passwordUser.email);

      expect(result.message).toMatch(/Se este email estiver cadastrado/);
      expect(prisma.passwordResetCode.updateMany).toHaveBeenCalledWith({
        where: { userId: passwordUser.id, consumedAt: null },
        data: { consumedAt: expect.any(Date) },
      });
      expect(prisma.passwordResetCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: passwordUser.id }),
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        passwordUser.email,
        passwordUser.name,
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('stays silent (still generic) once the hourly request limit is hit', async () => {
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.count.mockResolvedValue(3);

      const result = await service.forgotPassword(passwordUser.email);

      expect(result.message).toMatch(/Se este email estiver cadastrado/);
      expect(prisma.passwordResetCode.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyResetCode', () => {
    const activeCode = {
      id: 'code-1',
      userId: passwordUser.id,
      codeHash: '',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      attempts: 0,
    };

    it('throws for an unknown email without leaking which case it is', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.verifyResetCode('missing@example.com', '123456')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.passwordResetCode.findFirst).not.toHaveBeenCalled();
    });

    it('throws for a social-only account', async () => {
      usersService.findByEmail.mockResolvedValue(socialOnlyUser);

      await expect(service.verifyResetCode(socialOnlyUser.email, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws and increments attempts on a wrong code, without consuming it', async () => {
      const codeHash = await bcrypt.hash('654321', 10);
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({ ...activeCode, codeHash });

      await expect(service.verifyResetCode(passwordUser.email, '000000')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: activeCode.id },
        data: { attempts: { increment: 1 } },
      });
    });

    it('succeeds without consuming the code when it matches', async () => {
      const codeHash = await bcrypt.hash('654321', 10);
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({ ...activeCode, codeHash });

      const result = await service.verifyResetCode(passwordUser.email, '654321');

      expect(result.message).toMatch(/válido/);
      expect(prisma.passwordResetCode.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const activeCode = {
      id: 'code-1',
      userId: passwordUser.id,
      codeHash: '',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      attempts: 0,
    };

    it('throws for an unknown email without leaking which case it is', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword('missing@example.com', '123456', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetCode.findFirst).not.toHaveBeenCalled();
    });

    it('throws when there is no pending code', async () => {
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword(passwordUser.email, '123456', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws and does not consume the code when it has expired', async () => {
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({
        ...activeCode,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword(passwordUser.email, '123456', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetCode.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws once the code has already been locked out after 5 failed attempts', async () => {
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({ ...activeCode, attempts: 5 });

      await expect(
        service.resetPassword(passwordUser.email, '123456', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetCode.update).not.toHaveBeenCalled();
    });

    it('increments attempts and throws on a wrong code', async () => {
      const codeHash = await bcrypt.hash('654321', 10);
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({ ...activeCode, codeHash });

      await expect(
        service.resetPassword(passwordUser.email, '000000', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: activeCode.id },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates the password, consumes the code and revokes every session on success', async () => {
      const codeHash = await bcrypt.hash('654321', 10);
      usersService.findByEmail.mockResolvedValue(passwordUser);
      prisma.passwordResetCode.findFirst.mockResolvedValue({ ...activeCode, codeHash });

      const result = await service.resetPassword(passwordUser.email, '654321', 'NewPassw0rd');

      expect(result.message).toMatch(/atualizada com sucesso/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: passwordUser.id },
        data: { password: expect.any(String) },
      });
      expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: activeCode.id },
        data: { consumedAt: expect.any(Date) },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: passwordUser.id },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws for a social-only account (no password to reset)', async () => {
      usersService.findByEmail.mockResolvedValue(socialOnlyUser);

      await expect(
        service.resetPassword(socialOnlyUser.email, '123456', 'NewPassw0rd'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetCode.findFirst).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService — legal consent', () => {
  const consentData = {
    termsAcceptedAt: expect.any(Date),
    termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
    privacyAcceptedAt: expect.any(Date),
    privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
  };

  let service: AuthService;
  let prisma: {
    user: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
    session: { create: jest.Mock };
  };
  let usersService: UsersService;
  let verifyIdToken: jest.Mock;

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'new-user', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => ({ id: where.id, ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      session: { create: jest.fn().mockResolvedValue({}) },
    };
    // UsersService real: o que interessa é o legalConsentData/toUserModel de verdade.
    usersService = new UsersService(prisma as unknown as PrismaService);
    jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

    service = new AuthService(
      prisma as unknown as PrismaService,
      usersService,
      { sign: jest.fn().mockReturnValue('access-token') } as unknown as JwtService,
      {
        get: jest.fn((key: string, fallback?: string) =>
          key === 'GOOGLE_IOS_CLIENT_ID' ? 'google-client-id' : fallback,
        ),
      } as unknown as ConfigService,
      { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService,
    );
    verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub', email: 'new@example.com', name: 'New Athlete' }),
    });
    (service as unknown as { googleClient: { verifyIdToken: jest.Mock } }).googleClient = {
      verifyIdToken,
    };
  });

  it('records the accepted terms/privacy versions on email registration', async () => {
    const result = await service.register({
      email: 'new@example.com',
      password: 'Passw0rd!',
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining(consentData),
    });
    expect(result.user.legalConsentRequired).toBe(false);
  });

  it('refuses to create a social account without explicit consent', async () => {
    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(ForbiddenException);
    await expect(
      service.loginWithGoogle('id-token', { termsAccepted: true }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_LEGAL_CONSENT_REQUIRED' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates the social account with consent recorded when both documents are accepted', async () => {
    const result = await service.loginWithGoogle('id-token', {
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ googleUserId: 'google-sub', ...consentData }),
    });
    expect(result.user.legalConsentRequired).toBe(false);
  });

  it('still logs in an existing social account without consent, flagging it as required', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing',
      email: 'new@example.com',
      googleUserId: 'google-sub',
      termsVersion: null,
      privacyVersion: null,
    });

    const result = await service.loginWithGoogle('id-token');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.user.legalConsentRequired).toBe(true);
  });
});
