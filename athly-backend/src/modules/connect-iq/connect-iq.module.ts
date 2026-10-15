import { Module } from '@nestjs/common';
import { ConnectIqAccountController } from './connect-iq-account.controller';
import { ConnectIqActivitiesService } from './connect-iq-activities.service';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import { ConnectIqFitController } from './connect-iq-fit.controller';
import { ConnectIqPairingService } from './connect-iq-pairing.service';
import { ConnectIqSyncService } from './connect-iq-sync.service';
import { ConnectIqWatchController } from './connect-iq-watch.controller';
import { DeviceTokenGuard } from './guards/device-token.guard';

/**
 * Apps Connect IQ da Athly no relógio Garmin: pareamento, treinos como FIT nativo (app de relógio)
 * e corridas gravadas pelo campo de dados.
 */
@Module({
  controllers: [ConnectIqWatchController, ConnectIqFitController, ConnectIqAccountController],
  providers: [
    ConnectIqPairingService,
    ConnectIqDevicesService,
    ConnectIqSyncService,
    ConnectIqActivitiesService,
    DeviceTokenGuard,
  ],
})
export class ConnectIqModule {}
