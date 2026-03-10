import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiPlannerService } from './ai-planner.service';
import { PlanNextWeekInput } from './dto/plan-next-week.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { AiPlannerResultModel } from './models/ai-planner-result.model';

@ApiTags('ai-planner')
@ApiBearerAuth()
@Controller('ai-planner')
@UseGuards(JwtAuthGuard)
export class AiPlannerController {
  constructor(private readonly aiPlannerService: AiPlannerService) {}

  @Post('plan-next-week')
  @ApiOkResponse({ type: AiPlannerResultModel })
  planNextWeek(@CurrentUser() user: UserModel, @Body() input: PlanNextWeekInput): Promise<AiPlannerResultModel> {
    return this.aiPlannerService.planNextWeek(user.id, input) as Promise<AiPlannerResultModel>;
  }
}
