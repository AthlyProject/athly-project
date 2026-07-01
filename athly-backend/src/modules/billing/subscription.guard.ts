import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { BillingService } from './billing.service';

/**
 * Bloqueia endpoints pagos quando o usuário não tem entitlement (fora do trial e sem assinatura).
 * Fail-open enquanto PAYWALL_ENABLED != 'true'. Deve rodar depois do JwtAuthGuard (usa request.user).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.billingService.paywallEnabled) return true;

    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) return false;

    const entitled = await this.billingService.isEntitled(userId);
    if (!entitled) {
      throw new ForbiddenException(
        'Assinatura necessária. Inicie ou renove sua assinatura para continuar.',
      );
    }
    return true;
  }
}
