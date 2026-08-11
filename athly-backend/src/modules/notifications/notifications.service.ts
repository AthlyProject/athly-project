import { Injectable } from '@nestjs/common';
import { PushEnvironment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  PushDeviceEnvironmentDto,
  RegisterPushDeviceDto,
} from './dto/register-push-device.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, input: RegisterPushDeviceDto) {
    const device = await this.prisma.pushDevice.upsert({
      where: { token: input.token.toLowerCase() },
      create: {
        userId,
        token: input.token.toLowerCase(),
        environment:
          input.environment === PushDeviceEnvironmentDto.sandbox
            ? PushEnvironment.SANDBOX
            : PushEnvironment.PRODUCTION,
      },
      update: {
        userId,
        environment:
          input.environment === PushDeviceEnvironmentDto.sandbox
            ? PushEnvironment.SANDBOX
            : PushEnvironment.PRODUCTION,
        disabledAt: null,
      },
      select: { id: true, environment: true, updatedAt: true },
    });
    return {
      id: device.id,
      environment: device.environment.toLowerCase(),
      updatedAt: device.updatedAt,
    };
  }

  async unregisterDevice(userId: string, token: string) {
    await this.prisma.pushDevice.updateMany({
      where: { userId, token: token.toLowerCase() },
      data: { disabledAt: new Date() },
    });
  }
}
