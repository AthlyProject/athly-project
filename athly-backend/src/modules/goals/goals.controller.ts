import { normalizeLanguage } from '../../common/i18n/user-language';
import { GeminiService } from '../ai-planner/gemini.service';
import { InterpretGoalDto } from './dto/goal-draft.dto';
import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly gemini: GeminiService,
  ) {}

  @Post('interpret')
  @ApiOperation({ summary: 'Interpretar objetivo sem persistir' })
  interpret(@Body() dto: InterpretGoalDto, @Headers('x-athly-language') language?: string) {
    return this.gemini.interpretGoal(dto.goalText, normalizeLanguage(language));
  }

  @Get('active')
  @ApiOperation({ summary: 'Buscar objetivo ativo do usuário' })
  getActive(@CurrentUser() user: UserModel) {
    return this.goalsService.getActiveGoal(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os objetivos do usuário' })
  list(@CurrentUser() user: UserModel) {
    return this.goalsService.listGoals(user.id);
  }
}
