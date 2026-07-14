import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { isAdminEmail } from '../../common/admin-emails';

const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
}

interface RevenueCatWebhookBody {
  event?: RevenueCatEvent;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Enquanto false, todo o gating de assinatura é fail-open (ninguém é bloqueado). */
  get paywallEnabled(): boolean {
    return this.config.get<string>('PAYWALL_ENABLED', 'false') === 'true';
  }

  /** Valida o header Authorization do webhook. Se o segredo não estiver configurado, aceita (scaffold). */
  verifyWebhookAuth(authHeader?: string): void {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTH');
    if (!expected) return;
    if (authHeader !== expected) {
      throw new UnauthorizedException('Invalid RevenueCat webhook authorization.');
    }
  }

  async handleWebhook(body: RevenueCatWebhookBody): Promise<void> {
    const event = body?.event;
    if (!event?.app_user_id) {
      this.logger.warn('RevenueCat webhook sem app_user_id — ignorado');
      return;
    }

    // app_user_id deve ser o id do usuário Athly (o app faz Purchases.logIn(userId)).
    const userId = event.app_user_id;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`RevenueCat webhook: usuário ${userId} não encontrado`);
      return;
    }

    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const status = this.mapEventToStatus(event.type, expiresAt);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt,
        subscriptionProductId: event.product_id ?? user.subscriptionProductId,
        revenueCatUserId: userId,
      },
    });
    this.logger.log(
      `Assinatura atualizada (${userId}): ${status} — expira ${expiresAt?.toISOString() ?? 'n/a'}`,
    );
  }

  private mapEventToStatus(type: string | undefined, expiresAt: Date | null): string {
    const t = (type ?? '').toUpperCase();
    if (t === 'EXPIRATION') return 'expired';
    if (t === 'SUBSCRIPTION_PAUSED') return 'cancelled';
    if (t === 'CANCELLATION') {
      return expiresAt && expiresAt.getTime() > Date.now() ? 'cancelled' : 'expired';
    }
    if (expiresAt && expiresAt.getTime() < Date.now()) return 'expired';
    return 'active';
  }

  /** True se o e-mail está em `ADMIN_EMAILS` (contas de admin/dev — isentas de cobrança). */
  isAdminEmail(email: string | undefined | null): boolean {
    return isAdminEmail(email, this.config.get<string>('ADMIN_EMAILS'));
  }

  /** True se o e-mail entrou na waitlist e deve receber a oferta Founder. */
  async isFounderEligibleEmail(email: string | undefined | null): Promise<boolean> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return false;

    const entry = await this.prisma.waitlistEntry.findFirst({
      where: {
        email: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    return !!entry;
  }

  /**
   * Info do trial backend para os clients exibirem "X dias restantes".
   * Retorna nulls quando o banner não se aplica: paywall desligado, usuário admin,
   * assinatura ativa/cancelada-mas-vigente, ou trial já expirado.
   */
  async trialInfo(
    userId: string,
  ): Promise<{ trialEndsAt: string | null; trialDaysRemaining: number | null }> {
    const none = { trialEndsAt: null, trialDaysRemaining: null };
    if (!this.paywallEnabled) return none;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        email: true,
        role: true,
      },
    });
    if (!user) return none;
    if (user.role === 'ADMIN' || this.isAdminEmail(user.email)) return none;

    const now = Date.now();
    const hasActiveSubscription =
      ['active', 'cancelled'].includes(user.subscriptionStatus ?? '') &&
      !!user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() > now;
    if (hasActiveSubscription) return none;

    const trialEnds = user.createdAt.getTime() + TRIAL_DAYS * DAY_MS;
    if (now >= trialEnds) return none;

    return {
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialDaysRemaining: Math.ceil((trialEnds - now) / DAY_MS),
    };
  }

  /**
   * Entitlement = paywall desligado, OU admin (ADMIN_EMAILS / role ADMIN), OU trial (createdAt+14d),
   * OU assinatura ativa e não expirada.
   */
  async isEntitled(userId: string): Promise<boolean> {
    if (!this.paywallEnabled) return true;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        email: true,
        role: true,
      },
    });
    if (!user) return false;

    // Bypass de admin/dev: nunca cobrado, nunca bloqueado.
    if (user.role === 'ADMIN' || this.isAdminEmail(user.email)) return true;

    const now = Date.now();
    const trialEnds = user.createdAt.getTime() + TRIAL_DAYS * DAY_MS;
    if (now < trialEnds) return true;

    return (
      ['active', 'cancelled'].includes(user.subscriptionStatus ?? '') &&
      !!user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() > now
    );
  }
}
