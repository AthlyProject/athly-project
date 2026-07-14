import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { EntitlementModel } from './models/entitlement.model';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Snapshot de entitlement para o app (fonte de verdade do bypass de admin via ADMIN_EMAILS). */
  @Get('entitlement')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: EntitlementModel })
  async entitlement(@CurrentUser() user: UserModel): Promise<EntitlementModel> {
    const trial = await this.billingService.trialInfo(user.id);
    return {
      entitled: await this.billingService.isEntitled(user.id),
      isAdmin: this.billingService.isAdminEmail(user.email) || user.role === 'ADMIN',
      isFounderEligible: await this.billingService.isFounderEligibleEmail(user.email),
      trialEndsAt: trial.trialEndsAt,
      trialDaysRemaining: trial.trialDaysRemaining,
    };
  }

  /** Webhook do RevenueCat. Não usa JWT — autentica pelo header Authorization (segredo do RevenueCat). */
  @Post('revenuecat/webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async revenueCatWebhook(
    @Headers('authorization') auth: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: boolean }> {
    this.billingService.verifyWebhookAuth(auth);
    await this.billingService.handleWebhook(body as Parameters<BillingService['handleWebhook']>[0]);
    return { ok: true };
  }
}
