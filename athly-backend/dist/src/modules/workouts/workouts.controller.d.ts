import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutFeedbackInput } from './dto/submit-workout-feedback.dto';
import { UserModel } from '../users/models/user.model';
import { UpdateWorkoutInput } from './dto/workout-update.dto';
import { CreateWorkoutInput } from './dto/create-workout.dto';
import { WorkoutModel, WorkoutFeedbackModel } from './models/workout.model';
export declare class WorkoutsController {
    private readonly workoutsService;
    constructor(workoutsService: WorkoutsService);
    todayWorkout(user: UserModel): Promise<WorkoutModel | null>;
    workoutHistory(user: UserModel): Promise<WorkoutModel[]>;
    createWorkout(user: UserModel, input: CreateWorkoutInput): Promise<WorkoutModel>;
    workoutsByTrainingPlan(user: UserModel, trainingPlanId: string): Promise<WorkoutModel[]>;
    workout(user: UserModel, id: string): Promise<WorkoutModel | null>;
    submitWorkoutFeedback(user: UserModel, workoutId: string, input: SubmitWorkoutFeedbackInput): Promise<WorkoutFeedbackModel>;
    completeWorkout(user: UserModel, workoutId: string): Promise<WorkoutModel>;
    skipWorkout(user: UserModel, workoutId: string): Promise<WorkoutModel>;
    updateWorkout(workoutId: string, input: UpdateWorkoutInput): Promise<WorkoutModel>;
}
