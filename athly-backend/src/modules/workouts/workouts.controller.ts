import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutFeedbackInput } from './dto/submit-workout-feedback.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { UpdateWorkoutInput } from './dto/workout-update-input';
import { CreateWorkoutInput } from './dto/create-workout.input';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get('today')
  todayWorkout(@CurrentUser() user: UserModel) {
    return this.workoutsService.getTodayWorkout(user.id);
  }

  @Get('history')
  workoutHistory(@CurrentUser() user: UserModel) {
    return this.workoutsService.getWorkoutHistory(user.id);
  }

  @Post()
  createWorkout(@CurrentUser() user: UserModel, @Body() input: CreateWorkoutInput) {
    return this.workoutsService.createWorkout(user.id, input);
  }

  @Get('training-plan/:trainingPlanId')
  workoutsByTrainingPlan(
    @CurrentUser() user: UserModel,
    @Param('trainingPlanId') trainingPlanId: string,
  ) {
    return this.workoutsService.getWorkoutsByTrainingPlan(user.id, trainingPlanId);
  }

  @Get(':id')
  workout(@CurrentUser() user: UserModel, @Param('id') id: string) {
    return this.workoutsService.getWorkoutById(user.id, id);
  }

  @Post(':workoutId/feedback')
  submitWorkoutFeedback(
    @CurrentUser() user: UserModel,
    @Param('workoutId') workoutId: string,
    @Body() input: SubmitWorkoutFeedbackInput,
  ) {
    return this.workoutsService.submitWorkoutFeedback(user.id, workoutId, input);
  }

  @Patch(':workoutId/complete')
  completeWorkout(@CurrentUser() user: UserModel, @Param('workoutId') workoutId: string) {
    return this.workoutsService.completeWorkout(user.id, workoutId);
  }

  @Patch(':workoutId/skip')
  skipWorkout(@CurrentUser() user: UserModel, @Param('workoutId') workoutId: string) {
    return this.workoutsService.skipWorkout(user.id, workoutId);
  }

  @Put(':workoutId')
  updateWorkout(@Param('workoutId') workoutId: string, @Body() input: UpdateWorkoutInput) {
    return this.workoutsService.updateWorkout(workoutId, input);
  }
}
