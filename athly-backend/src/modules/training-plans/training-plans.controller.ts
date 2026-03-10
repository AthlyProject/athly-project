import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrainingPlansService } from './training-plans.service';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { TrainingPlanModel } from './models/training-plan.model';

@ApiTags('training-plans')
@ApiBearerAuth()
@Controller('training-plans')
@UseGuards(JwtAuthGuard)
export class TrainingPlansController {
  constructor(private readonly trainingPlansService: TrainingPlansService) {}

  @Get('me')
  @ApiOkResponse({ type: TrainingPlanModel })
  getMyTrainingPlan(@CurrentUser() user: UserModel): Promise<TrainingPlanModel | null> {
    return this.trainingPlansService.getMyTrainingPlan(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: TrainingPlanModel })
  getTrainingPlanById(@CurrentUser() user: UserModel, @Param('id') id: string): Promise<TrainingPlanModel | null> {
    return this.trainingPlansService.getTrainingPlanById(user.id, id);
  }

  @Post()
  @ApiCreatedResponse({ type: TrainingPlanModel })
  createTrainingPlan(@CurrentUser() user: UserModel, @Body() input: CreateTrainingPlanInput): Promise<TrainingPlanModel> {
    return this.trainingPlansService.createTrainingPlan(user.id, input);
  }

  @Put(':id')
  @ApiOkResponse({ type: TrainingPlanModel })
  updateTrainingPlan(
    @CurrentUser() user: UserModel,
    @Param('id') id: string,
    @Body() input: UpdateTrainingPlanInput,
  ): Promise<TrainingPlanModel> {
    return this.trainingPlansService.updateTrainingPlan(user.id, id, input);
  }

  @Delete(':id')
  @ApiOkResponse()
  deleteTrainingPlan(@CurrentUser() user: UserModel, @Param('id') id: string): Promise<void> {
    return this.trainingPlansService.deleteTrainingPlan(user.id, id);
  }
}
