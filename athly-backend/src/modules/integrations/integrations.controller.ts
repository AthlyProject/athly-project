import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { StravaCallbackInput } from './dto/strava-callback.input';
import { IntegrationModel } from './models/integration.model';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOkResponse({ type: IntegrationModel, isArray: true })
  integrations(@CurrentUser() user: UserModel): Promise<IntegrationModel[]> {
    return this.integrationsService.getIntegrations(user.id);
  }

  @Post(':integrationId/connect')
  @ApiOkResponse({ type: IntegrationModel })
  connectIntegration(
    @CurrentUser() user: UserModel,
    @Param('integrationId') integrationId: string,
  ): Promise<IntegrationModel> {
    return this.integrationsService.connectIntegration(user.id, integrationId);
  }

  @Delete(':integrationId/disconnect')
  @ApiOkResponse({ type: IntegrationModel })
  disconnectIntegration(
    @CurrentUser() user: UserModel,
    @Param('integrationId') integrationId: string,
  ): Promise<IntegrationModel> {
    return this.integrationsService.disconnectIntegration(user.id, integrationId);
  }

  // ─── Strava OAuth ───────────────────────────────────────────────────────────

  @Get('strava/auth')
  @ApiOkResponse({ schema: { type: 'object', properties: { url: { type: 'string' } } } })
  getStravaAuthUrl(): { url: string } {
    return { url: this.integrationsService.getStravaAuthUrl() };
  }

  @Post('strava/callback')
  @ApiOkResponse({ type: IntegrationModel })
  handleStravaCallback(
    @CurrentUser() user: UserModel,
    @Body() input: StravaCallbackInput,
  ): Promise<IntegrationModel> {
    return this.integrationsService.handleStravaCallback(user.id, input.code);
  }

  @Post('strava/sync')
  @ApiOkResponse({ schema: { type: 'object', properties: { synced: { type: 'number' } } } })
  syncStrava(@CurrentUser() user: UserModel): Promise<{ synced: number }> {
    return this.integrationsService.syncStravaActivities(user.id);
  }

  @Post('strava/disconnect')
  @ApiOkResponse()
  disconnectStrava(@CurrentUser() user: UserModel): Promise<void> {
    return this.integrationsService.disconnectStrava(user.id);
  }
}
