import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutFeedbackInput } from './dto/submit-workout-feedback.input';
import { UserModel } from '../users/models/user.model';
import { UpdateWorkoutInput } from './dto/workout-update-input';
import { CreateWorkoutInput } from './dto/create-workout.input';
export declare class WorkoutsController {
    private readonly workoutsService;
    constructor(workoutsService: WorkoutsService);
    todayWorkout(user: UserModel): Promise<import("./models/workout.model").WorkoutModel | null>;
    workoutHistory(user: UserModel): Promise<{
        status: "done";
        id: string;
        date: string;
        sportType: import("@prisma/client").SportType;
        title: string;
        description?: string;
        blocks: import("./models/workout.model").WorkoutBlock[];
        intensity?: number;
        stravaActivityId?: string | null;
    }[]>;
    createWorkout(user: UserModel, input: CreateWorkoutInput): Promise<import("./models/workout.model").WorkoutModel>;
    workoutsByTrainingPlan(user: UserModel, trainingPlanId: string): Promise<import("./models/workout.model").WorkoutModel[]>;
    workout(user: UserModel, id: string): Promise<import("./models/workout.model").WorkoutModel | null>;
    submitWorkoutFeedback(user: UserModel, workoutId: string, input: SubmitWorkoutFeedbackInput): Promise<import("./models/workout.model").WorkoutFeedbackModel>;
    completeWorkout(user: UserModel, workoutId: string): Promise<import("./models/workout.model").WorkoutModel>;
    skipWorkout(user: UserModel, workoutId: string): Promise<import("./models/workout.model").WorkoutModel>;
    updateWorkout(workoutId: string, input: UpdateWorkoutInput): Promise<import("./models/workout.model").WorkoutModel>;
}
