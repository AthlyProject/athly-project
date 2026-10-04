import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CodedUnauthorizedException } from '../../../common/errors/coded-exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { CiqDeviceContext, ConnectIqDevicesService } from '../connect-iq-devices.service';
import { bearerToken } from '../utils/secrets';

export type CiqRequest = Request & { ciqDevice?: CiqDeviceContext };

/** Autentica o relógio pelo token de dispositivo (`Authorization: Bearer ciq_…`). */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private readonly devices: ConnectIqDevicesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CiqRequest>();
    const token = bearerToken(request.headers.authorization);
    const device = token ? await this.devices.authenticate(token) : null;
    if (!device) {
      throw new CodedUnauthorizedException(
        ErrorCode.CIQ_DEVICE_UNAUTHORIZED,
        'Relógio desconectado. Pareie de novo pelo app Athly.',
      );
    }
    request.ciqDevice = device;
    return true;
  }
}
