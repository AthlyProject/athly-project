import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutFeedbackInput } from './dto/submit-workout-feedback.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { UpdateWorkoutInput } from './dto/workout-update-input';
import { CreateWorkoutInput } from './dto/create-workout.input';
import { WorkoutModel, WorkoutFeedbackModel } from './models/workout.model';

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get('today')
  @ApiOkResponse({ type: WorkoutModel })
  todayWorkout(@CurrentUser() user: UserModel): Promise<WorkoutModel | null> {
    return this.workoutsService.getTodayWorkout(user.id);
  }

  @Get('history')
  @ApiOkResponse({ type: WorkoutModel, isArray: true })
  workoutHistory(@CurrentUser() user: UserModel): Promise<WorkoutModel[]> {
    return this.workoutsService.getWorkoutHistory(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: WorkoutModel })
  createWorkout(@CurrentUser() user: UserModel, @Body() input: CreateWorkoutInput): Promise<WorkoutModel> {
    return this.workoutsService.createWorkout(user.id, input);
  }

  @Get('training-plan/:trainingPlanId')
  @ApiOkResponse({ type: WorkoutModel, isArray: true })
  workoutsByTrainingPlan(
    @CurrentUser() user: UserModel,
    @Param('trainingPlanId') trainingPlanId: string,
  ): Promise<WorkoutModel[]> {
    return this.workoutsService.getWorkoutsByTrainingPlan(user.id, trainingPlanId);
  }

  @Get(':id')
  @ApiOkResponse({ type: WorkoutModel })
  workout(@CurrentUser() user: UserModel, @Param('id') id: string): Promise<WorkoutModel | null> {
    return this.workoutsService.getWorkoutById(user.id, id);
  }

  @Post(':workoutId/feedback')
  @ApiCreatedResponse({ type: WorkoutFeedbackModel })
  submitWorkoutFeedback(
    @CurrentUser() user: UserModel,
    @Param('workoutId') workoutId: string,
    @Body() input: SubmitWorkoutFeedbackInput,
  ): Promise<WorkoutFeedbackModel> {
    return this.workoutsService.submitWorkoutFeedback(user.id, workoutId, input);
  }

  @Patch(':workoutId/complete')
  @ApiOkResponse({ type: WorkoutModel })
  completeWorkout(@CurrentUser() user: UserModel, @Param('workoutId') workoutId: string): Promise<WorkoutModel> {
    return this.workoutsService.completeWorkout(user.id, workoutId);
  }

  @Patch(':workoutId/skip')
  @ApiOkResponse({ type: WorkoutModel })
  skipWorkout(@CurrentUser() user: UserModel, @Param('workoutId') workoutId: string): Promise<WorkoutModel> {
    return this.workoutsService.skipWorkout(user.id, workoutId);
  }

  @Put(':workoutId')
  @ApiOkResponse({ type: WorkoutModel })
  updateWorkout(@Param('workoutId') workoutId: string, @Body() input: UpdateWorkoutInput): Promise<WorkoutModel> {
    return this.workoutsService.updateWorkout(workoutId, input);
  }
}
