import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WeeklyGoalsService } from './weekly-goals.service';
import { CreateWeeklyGoalInput } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalInput } from './dto/update-weekly-goal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { WeeklyGoalModel } from './models/weekly-goal.model';

@ApiTags('weekly-goals')
@ApiBearerAuth()
@Controller('weekly-goals')
@UseGuards(JwtAuthGuard)
export class WeeklyGoalsController {
  constructor(private readonly weeklyGoalsService: WeeklyGoalsService) {}

  @Get('training-plan/:trainingPlanId')
  @ApiOkResponse({ type: WeeklyGoalModel, isArray: true })
  getWeeklyGoalsByTrainingPlan(
    @CurrentUser() user: UserModel,
    @Param('trainingPlanId') trainingPlanId: string,
  ): Promise<WeeklyGoalModel[]> {
    return this.weeklyGoalsService.getWeeklyGoalsByTrainingPlan(user.id, trainingPlanId);
  }

  @Get(':uuid')
  @ApiOkResponse({ type: WeeklyGoalModel })
  getWeeklyGoalById(@CurrentUser() user: UserModel, @Param('uuid') uuid: string): Promise<WeeklyGoalModel | null> {
    return this.weeklyGoalsService.getWeeklyGoalById(user.id, uuid);
  }

  @Post()
  @ApiCreatedResponse({ type: WeeklyGoalModel })
  createWeeklyGoal(@CurrentUser() user: UserModel, @Body() input: CreateWeeklyGoalInput): Promise<WeeklyGoalModel> {
    return this.weeklyGoalsService.createWeeklyGoal(user.id, input);
  }

  @Put(':uuid')
  @ApiOkResponse({ type: WeeklyGoalModel })
  updateWeeklyGoal(
    @CurrentUser() user: UserModel,
    @Param('uuid') uuid: string,
    @Body() input: UpdateWeeklyGoalInput,
  ): Promise<WeeklyGoalModel> {
    return this.weeklyGoalsService.updateWeeklyGoal(user.id, uuid, input);
  }

  @Delete(':uuid')
  @ApiOkResponse()
  deleteWeeklyGoal(@CurrentUser() user: UserModel, @Param('uuid') uuid: string): Promise<void> {
    return this.weeklyGoalsService.deleteWeeklyGoal(user.id, uuid);
  }
}
