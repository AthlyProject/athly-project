import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Assessment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  @ApiOperation({ summary: 'Submit the onboarding assessment' })
  submit(@Request() req: { user: { id: string } }, @Body() dto: SubmitAssessmentDto) {
    return this.assessmentService.submit(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the current user assessment answers' })
  findMine(@Request() req: { user: { id: string } }) {
    return this.assessmentService.findByUser(req.user.id);
  }
}
