import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import type { CiqDeviceContext } from './connect-iq-devices.service';
import { ConnectIqPairingService } from './connect-iq-pairing.service';
import { ConnectIqSyncService } from './connect-iq-sync.service';
import { CurrentCiqDevice } from './decorators/current-ciq-device.decorator';
import {
  CreatePairingDto,
  PollPairingDto,
  SyncReportDto,
  WatchDateQueryDto,
} from './dto/connect-iq.dto';
import { CiqEnvelopeFilter } from './filters/ciq-envelope.filter';
import { DeviceTokenGuard } from './guards/device-token.guard';
import {
  ConnectIqManifestModel,
  ConnectIqPairingModel,
  ConnectIqPollModel,
} from './models/connect-iq.model';

/**
 * Rotas JSON chamadas pelo app Connect IQ no relógio. Sempre HTTP 200 (erros no envelope do
 * `CiqEnvelopeFilter`) e sem cache: o Garmin Connect faz proxy das requisições do relógio.
 */
@ApiTags('connect-iq')
@Controller('connect-iq')
@UseFilters(CiqEnvelopeFilter)
export class ConnectIqWatchController {
  constructor(
    private readonly pairing: ConnectIqPairingService,
    private readonly devices: ConnectIqDevicesService,
    private readonly sync: ConnectIqSyncService,
  ) {}

  @Post('pairings')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ConnectIqPairingModel })
  createPairing(@Body() input: CreatePairingDto): Promise<ConnectIqPairingModel> {
    return this.pairing.createPairing(input);
  }

  @Post('pairings/poll')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ConnectIqPollModel })
  poll(@Body() input: PollPairingDto): Promise<ConnectIqPollModel> {
    return this.pairing.poll(input.pollToken);
  }

  @Get('manifest')
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConnectIqManifestModel })
  manifest(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Query() query: WatchDateQueryDto,
  ): Promise<ConnectIqManifestModel> {
    return this.sync.manifest(device.userId, query.today);
  }

  @Post('sync-reports')
  @HttpCode(200)
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  async syncReport(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Body() report: SyncReportDto,
  ): Promise<Record<string, never>> {
    await this.devices.recordSyncReport(device, report);
    return {};
  }

  /** "Desconectar" no próprio relógio. */
  @Delete('device')
  @HttpCode(200)
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  async unpairSelf(@CurrentCiqDevice() device: CiqDeviceContext): Promise<Record<string, never>> {
    await this.devices.unpair(device.userId, device.id);
    return {};
  }
}
