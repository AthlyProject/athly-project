import { Body, Controller, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserModel } from '../users/models/user.model';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Put('devices')
  register(@CurrentUser() user: UserModel, @Body() input: RegisterPushDeviceDto) {
    return this.notificationsService.registerDevice(user.id, input);
  }

  @Delete('devices/:token')
  async unregister(@CurrentUser() user: UserModel, @Param('token') token: string) {
    await this.notificationsService.unregisterDevice(user.id, token);
    return {};
  }
}
