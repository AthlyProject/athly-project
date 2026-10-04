import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CiqRequest } from '../guards/device-token.guard';

/** Relógio autenticado pelo `DeviceTokenGuard`. */
export const CurrentCiqDevice = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<CiqRequest>().ciqDevice,
);
