import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileInput } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from './models/user.model';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserModel })
  me(@CurrentUser() user: UserModel): UserModel {
    return user;
  }

  @Put('profile')
  @ApiOkResponse({ type: UserModel })
  async updateProfile(
    @CurrentUser() user: UserModel,
    @Body() input: UpdateProfileInput,
  ): Promise<UserModel> {
    const { password, dateOfBirth, ...updateData } = input;

    const data: any = { ...updateData };
    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    }

    return this.usersService.updateProfile(user.id, data, password);
  }
}
