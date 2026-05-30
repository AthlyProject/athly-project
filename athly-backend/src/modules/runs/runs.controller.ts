import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { CreateRunDto } from './dto/create-run.dto';
import { RunHistoryModel, SaveRunResponseModel } from './models/run.model';

@ApiTags('runs')
@ApiBearerAuth()
@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  @ApiCreatedResponse({ type: SaveRunResponseModel })
  create(
    @CurrentUser() user: UserModel,
    @Body() input: CreateRunDto,
  ): Promise<SaveRunResponseModel> {
    return this.runsService.createRun(user.id, input);
  }

  @Get('history')
  @ApiOkResponse({ type: RunHistoryModel, isArray: true })
  history(@CurrentUser() user: UserModel): Promise<RunHistoryModel[]> {
    return this.runsService.getHistory(user.id);
  }
}
