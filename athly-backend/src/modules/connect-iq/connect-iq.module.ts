import { Module } from '@nestjs/common';
import { ConnectIqAccountController } from './connect-iq-account.controller';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import { ConnectIqFitController } from './connect-iq-fit.controller';
import { ConnectIqPairingService } from './connect-iq-pairing.service';
import { ConnectIqSyncService } from './connect-iq-sync.service';
import { ConnectIqWatchController } from './connect-iq-watch.controller';
import { DeviceTokenGuard } from './guards/device-token.guard';

/** App Connect IQ da Athly no relógio Garmin: pareamento e treinos como FIT nativo. */
@Module({
  controllers: [ConnectIqWatchController, ConnectIqFitController, ConnectIqAccountController],
  providers: [
    ConnectIqPairingService,
    ConnectIqDevicesService,
    ConnectIqSyncService,
    DeviceTokenGuard,
  ],
})
export class ConnectIqModule {}
