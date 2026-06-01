import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiPlannerService } from './ai-planner.service';
import { PlanFromHealthDto } from './dto/plan-from-health.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { AiPlannerResultModel } from './models/ai-planner-result.model';
import { SubscriptionGuard } from '../billing/subscription.guard';

@ApiTags('ai-planner')
@ApiBearerAuth()
@Controller('ai-planner')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class AiPlannerController {
  constructor(private readonly aiPlannerService: AiPlannerService) {}

  @Post('plan-from-health')
  @ApiOkResponse({ type: AiPlannerResultModel })
  planFromHealth(
    @CurrentUser() user: UserModel,
    @Body() input: PlanFromHealthDto,
  ): Promise<AiPlannerResultModel> {
    return this.aiPlannerService.planFromHealth(user.id, input) as Promise<AiPlannerResultModel>;
  }
}
