import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export const GOAL_DISTANCES = ['5k', '10k', '15k', 'half', '42k', 'ultra'] as const;
export const GOAL_TYPES = ['target_time', 'workload'] as const;

/** Meta pessoal com as mesmas respostas do onboarding: distância, tipo, tempo alvo e data. */
export class GoalDraftDto {
  @ApiProperty({ enum: GOAL_DISTANCES })
  @IsIn(GOAL_DISTANCES)
  objectiveDistance: (typeof GOAL_DISTANCES)[number];

  @ApiProperty({
    enum: GOAL_TYPES,
    description: 'target_time = com tempo alvo; workload = completar',
  })
  @IsIn(GOAL_TYPES)
  objectiveType: (typeof GOAL_TYPES)[number];

  @ApiPropertyOptional({ example: '2:00:00', description: 'H:MM:SS ou MM:SS; só com target_time' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/)
  targetTime?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Data da prova (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;
}
