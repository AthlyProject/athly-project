import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConnectIqActivitiesService } from './connect-iq-activities.service';
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
import {
  ConnectIqActivityHeaderDto,
  ConnectIqActivityPartDto,
  WatchActivityStatusQueryDto,
} from './dto/connect-iq-activity.dto';
import { DeviceTokenGuard } from './guards/device-token.guard';
import {
  ConnectIqActivityUploadModel,
  ConnectIqWatchActivityStatusListModel,
} from './models/connect-iq-activity.model';
import type { WatchPlan } from './fit/workout-watch-plan';
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
    private readonly activities: ConnectIqActivitiesService,
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

  /**
   * Plano do treino para o player do app no relógio (os mesmos passos do FIT). Rota JSON: erros no
   * envelope, como o manifesto; o download FIT fica em ConnectIqFitController.
   */
  @Get('workouts/:workoutId/plan')
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Plano: { rev, name, steps: [passo | { repeatFrom, times }] }' })
  workoutPlan(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Query() query: WatchDateQueryDto,
  ): Promise<WatchPlan> {
    return this.sync.workoutPlan(device.userId, workoutId, query.today);
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

  /** Cabeçalho de uma corrida gravada pelo campo de dados; devolve os blocos já recebidos. */
  @Post('activities')
  @HttpCode(200)
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConnectIqActivityUploadModel })
  activityHeader(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Body() header: ConnectIqActivityHeaderDto,
  ): Promise<ConnectIqActivityUploadModel> {
    return this.activities.receiveHeader(device, header);
  }

  /** Situação das corridas que o relógio enviou (chegaram? o atleta confirmou no app?). */
  @Get('activities/status')
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConnectIqWatchActivityStatusListModel })
  async activityStatus(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Query() query: WatchActivityStatusQueryDto,
  ): Promise<ConnectIqWatchActivityStatusListModel> {
    return { runs: await this.activities.watchStatus(device, query.ids.split(',')) };
  }

  /** Um bloco da rota (base64). */
  @Post('activities/:clientId/parts')
  @HttpCode(200)
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConnectIqActivityUploadModel })
  activityPart(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Param('clientId') clientId: string,
    @Body() part: ConnectIqActivityPartDto,
  ): Promise<ConnectIqActivityUploadModel> {
    return this.activities.receivePart(device, clientId, part);
  }

  /**
   * Confirma o token logo depois do pareamento. O campo de dados só fala com o backend quando envia
   * uma corrida; sem esta chamada o dispositivo ficaria pendente (e seria apagado em 24 h).
   */
  @Get('device')
  @UseGuards(DeviceTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  confirmDevice(): Record<string, never> {
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
