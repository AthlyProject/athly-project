import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class SubmitWorkoutFeedbackInput {
  @IsBoolean()
  completed: boolean;

  @IsInt()
  @Min(1)
  @Max(10)
  effort: number;

  @IsInt()
  @Min(1)
  @Max(10)
  fatigue: number;
}
