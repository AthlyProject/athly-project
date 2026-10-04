import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserModel } from '../users/models/user.model';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import { ConnectIqPairingService } from './connect-iq-pairing.service';
import { ClaimPairingDto } from './dto/connect-iq.dto';
import { ConnectIqDeviceModel } from './models/connect-iq.model';

/** Relógios Garmin do usuário logado: parear com o código do relógio, listar e desparear. */
@ApiTags('connect-iq')
@ApiBearerAuth()
@Controller('connect-iq')
@UseGuards(JwtAuthGuard)
export class ConnectIqAccountController {
  constructor(
    private readonly pairing: ConnectIqPairingService,
    private readonly devices: ConnectIqDevicesService,
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

  @Delete('devices/:deviceId')
  async unpair(
    @CurrentUser() user: UserModel,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ): Promise<Record<string, never>> {
    await this.devices.unpair(user.id, deviceId);
    return {};
  }
}
