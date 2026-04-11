import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar objetivo de corrida em texto livre' })
  create(@CurrentUser() user: UserModel, @Body() dto: CreateGoalDto) {
    return this.goalsService.createGoal(user.id, dto);
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
