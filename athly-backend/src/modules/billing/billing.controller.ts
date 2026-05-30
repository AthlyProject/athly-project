import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
