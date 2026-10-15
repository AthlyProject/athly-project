import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserModel } from '../users/models/user.model';
import { ConnectIqActivitiesService } from './connect-iq-activities.service';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import { ConnectIqPairingService } from './connect-iq-pairing.service';
import { ResolveConnectIqActivityDto } from './dto/connect-iq-activity.dto';
import { ClaimPairingDto } from './dto/connect-iq.dto';
import {
  ConnectIqActivityDetailModel,
  ConnectIqActivitySummaryModel,
} from './models/connect-iq-activity.model';
import { ConnectIqDeviceModel } from './models/connect-iq.model';

/**
 * Relógios Garmin do usuário logado: parear com o código do relógio, listar e desparear; e as
 * corridas que o campo de dados enviou, para o app perguntar o que fazer com cada uma.
 */
@ApiTags('connect-iq')
@ApiBearerAuth()
@Controller('connect-iq')
@UseGuards(JwtAuthGuard)
export class ConnectIqAccountController {
  constructor(
    private readonly pairing: ConnectIqPairingService,
    private readonly devices: ConnectIqDevicesService,
    private readonly activities: ConnectIqActivitiesService,
  ) {}

  @Post('pairings/claim')
  @ApiCreatedResponse({ type: ConnectIqDeviceModel })
  claim(
    @CurrentUser() user: UserModel,
    @Body() input: ClaimPairingDto,
  ): Promise<ConnectIqDeviceModel> {
    return this.pairing.claim(user.id, input.code);
  }

  @Get('devices')
  @ApiOkResponse({ type: ConnectIqDeviceModel, isArray: true })
  list(@CurrentUser() user: UserModel): Promise<ConnectIqDeviceModel[]> {
    return this.devices.list(user.id);
  }

  @Get('activities')
  @ApiOkResponse({ type: ConnectIqActivitySummaryModel, isArray: true })
  pendingActivities(@CurrentUser() user: UserModel): Promise<ConnectIqActivitySummaryModel[]> {
    return this.activities.listPending(user.id);
  }

  @Get('activities/:activityId')
  @ApiOkResponse({ type: ConnectIqActivityDetailModel })
  activity(
    @CurrentUser() user: UserModel,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ): Promise<ConnectIqActivityDetailModel> {
    return this.activities.detail(user.id, activityId);
  }

  @Post('activities/:activityId/resolve')
  @HttpCode(200)
  async resolveActivity(
    @CurrentUser() user: UserModel,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() input: ResolveConnectIqActivityDto,
  ): Promise<Record<string, never>> {
    await this.activities.resolve(user.id, activityId, input);
    return {};
  }

  @Delete('devices/:deviceId')
  async unpair(
    @CurrentUser() user: UserModel,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ): Promise<Record<string, never>> {
    await this.devices.unpair(user.id, deviceId);
    return {};
  }
}
