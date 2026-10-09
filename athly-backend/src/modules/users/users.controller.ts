import { Controller, Get, Put, Post, Delete, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from './models/user.model';
import { LegalConsentDto } from '../auth/dto/legal-consent.dto';
import { HeartRateHealthService } from './heart-rate-health.service';
import { HeartRateHealthDto } from './dto/heart-rate-health.dto';
import { HeartRateZonesModel } from './models/heart-rate-zones.model';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly heartRateHealth: HeartRateHealthService,
  ) {}

  @Get('me/heart-rate-zones')
  @ApiOkResponse({ type: HeartRateZonesModel })
  heartRateZones(@CurrentUser() user: UserModel) {
    return this.heartRateHealth.zones(user.id);
  }

  @Put('me/heart-rate-health')
  @ApiOkResponse({ type: HeartRateZonesModel })
  syncHeartRateHealth(@CurrentUser() user: UserModel, @Body() input: HeartRateHealthDto) {
    return this.heartRateHealth.sync(user.id, input);
  }

  @Get('me')
  @ApiOkResponse({ type: UserModel })
  me(@CurrentUser() user: UserModel): UserModel {
    return user;
  }

  @Put('profile')
  @ApiOkResponse({ type: UserModel })
  async updateProfile(
    @CurrentUser() user: UserModel,
    @Body() input: UpdateProfileDto,
  ): Promise<UserModel> {
    const { password, dateOfBirth, ...updateData } = input;

    const data: any = { ...updateData };
    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    }

    return this.usersService.updateProfile(user.id, data, password);
  }

  /**
   * Registra o aceite das versões vigentes dos Termos e da Política de Privacidade — usado por
   * contas sem aceite registrado (anteriores a este controle) e quando um documento muda.
   */
  @Post('me/legal-consent')
  @HttpCode(200)
  @ApiOkResponse({ type: UserModel })
  async acceptLegalConsent(
    @CurrentUser() user: UserModel,
    // Só valida o corpo (os dois aceites = true); o registro usa as versões vigentes do servidor.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _input: LegalConsentDto,
  ): Promise<UserModel> {
    return this.usersService.acceptLegalConsent(user.id);
  }

  @Delete('me')
  @ApiOkResponse({
    schema: { type: 'object', properties: { deleted: { type: 'boolean' } } },
    description: 'Exclui a conta do usuário e todos os dados relacionados (cascade).',
  })
  async deleteAccount(@CurrentUser() user: UserModel): Promise<{ deleted: boolean }> {
    await this.usersService.deleteUser(user.id);
    return { deleted: true };
  }
}
