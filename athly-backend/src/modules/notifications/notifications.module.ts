import { Module } from '@nestjs/common';
import { ApnsClientService } from './apns-client.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDeliveryWorker } from './push-delivery.worker';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ApnsClientService, PushDeliveryWorker],
})
export class NotificationsModule {}
