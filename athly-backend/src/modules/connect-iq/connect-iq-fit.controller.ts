import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { CiqDeviceContext } from './connect-iq-devices.service';
import { ConnectIqSyncService } from './connect-iq-sync.service';
import { CurrentCiqDevice } from './decorators/current-ciq-device.decorator';
import { WatchDateQueryDto } from './dto/connect-iq.dto';
import { FIT_CONTENT_TYPE } from './fit/fit.constants';
import { DeviceTokenGuard } from './guards/device-token.guard';

/**
 * Arquivo FIT baixado pelo relógio com `HTTP_RESPONSE_CONTENT_TYPE_FIT`: o próprio relógio grava
 * o treino na lista nativa. Fica fora do envelope JSON — aqui só importa o status e o binário.
 */
@ApiTags('connect-iq')
@ApiBearerAuth()
@Controller('connect-iq')
@UseGuards(DeviceTokenGuard)
export class ConnectIqFitController {
  constructor(private readonly sync: ConnectIqSyncService) {}

  @Get('workouts/:workoutId/fit')
  @Header('Cache-Control', 'no-store')
  @ApiProduces(FIT_CONTENT_TYPE)
  @ApiOkResponse({ description: 'Treino em FIT (file_id + workout + workout_step)' })
  async workoutFit(
    @CurrentCiqDevice() device: CiqDeviceContext,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Query() query: WatchDateQueryDto,
  ): Promise<StreamableFile> {
    const bytes = await this.sync.workoutFit(device.userId, workoutId, query.today);
    return new StreamableFile(Buffer.from(bytes), {
      type: FIT_CONTENT_TYPE,
      length: bytes.length,
    });
  }
}
