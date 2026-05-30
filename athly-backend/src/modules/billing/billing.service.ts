import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

const TRIAL_DAYS = 7;
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
    if (['CANCELLATION', 'EXPIRATION', 'SUBSCRIPTION_PAUSED'].includes(t)) return 'cancelled';
    if (expiresAt && expiresAt.getTime() < Date.now()) return 'expired';
    return 'active';
  }

  /** Entitlement = paywall desligado, OU trial (createdAt+7d), OU assinatura ativa e não expirada. */
  async isEntitled(userId: string): Promise<boolean> {
    if (!this.paywallEnabled) return true;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });
    if (!user) return false;

    const now = Date.now();
    const trialEnds = user.createdAt.getTime() + TRIAL_DAYS * DAY_MS;
    if (now < trialEnds) return true;

    return (
      user.subscriptionStatus === 'active' &&
      !!user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() > now
    );
  }
}
