import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { GoalDraftDto } from './dto/goal-draft.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Buscar objetivo ativo do usuário' })
  getActive(@CurrentUser() user: UserModel) {
    return this.goalsService.getActiveGoal(user.id);
  }

  @Put('active')
  @ApiOperation({
    summary: 'Trocar o objetivo ativo',
    description:
      'Vale para as próximas semanas geradas; as semanas já entregues ficam. Recusa com 409 enquanto um plano está sendo gerado.',
  })
  replaceActive(@CurrentUser() user: UserModel, @Body() draft: GoalDraftDto) {
    return this.goalsService.replaceActiveGoal(user.id, draft);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os objetivos do usuário' })
  list(@CurrentUser() user: UserModel) {
    return this.goalsService.listGoals(user.id);
  }
}
