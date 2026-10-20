import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { GoalDraftDto } from '../../goals/dto/goal-draft.dto';
import { PlanFromHealthDto } from './plan-from-health.dto';

/**
 * O mesmo Health que o app manda para gerar o plano, para a análise e a geração usarem os mesmos
 * dados. Sem `goal`, analisa a meta ativa; com `goal`, uma meta em rascunho (troca de meta).
 */
export class GoalAnalysisDto extends PlanFromHealthDto {
  @ApiPropertyOptional({ type: () => GoalDraftDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GoalDraftDto)
  goal?: GoalDraftDto;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timeZone?: string;
}
