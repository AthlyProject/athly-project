import { PrismaService } from '../../database/prisma.service';
import { SubmitWorkoutFeedbackInput } from './dto/submit-workout-feedback.input';
import { WorkoutFeedbackModel, WorkoutModel } from './models/workout.model';
import { UpdateWorkoutInput } from './dto/workout-update-input';
import { CreateWorkoutInput } from './dto/create-workout.input';
export declare class WorkoutsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getTodayWorkout(userId: string): Promise<WorkoutModel | null>;
    getWorkoutById(userId: string, id: string): Promise<WorkoutModel | null>;
    createWorkout(userId: string, input: CreateWorkoutInput): Promise<WorkoutModel>;
    getWorkoutsByTrainingPlan(userId: string, trainingPlanId: string): Promise<WorkoutModel[]>;
    getWorkoutHistory(userId: string): Promise<{
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
    submitWorkoutFeedback(userId: string, workoutId: string, input: SubmitWorkoutFeedbackInput): Promise<WorkoutFeedbackModel>;
    completeWorkout(userId: string, workoutId: string): Promise<WorkoutModel>;
    skipWorkout(userId: string, workoutId: string): Promise<WorkoutModel>;
    private mapWorkout;
    updateWorkout(workoutId: string, input: UpdateWorkoutInput): Promise<WorkoutModel>;
}
