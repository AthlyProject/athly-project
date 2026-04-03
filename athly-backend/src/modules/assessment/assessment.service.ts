import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

@Injectable()
export class AssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, dto: SubmitAssessmentDto) {
    if (!dto.termsAccepted) {
      throw new ConflictException('Você precisa aceitar os termos para continuar.');
    }

    const [assessment] = await this.prisma.$transaction([
      this.prisma.assessment.upsert({
        where: { userId },
        create: {
          userId,
          answers: dto as any,
        },
        update: {
          answers: dto as any,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { assessmentCompleted: true },
      }),
    ]);

    return assessment;
  }

  async findByUser(userId: string) {
    return this.prisma.assessment.findUnique({ where: { userId } });
  }
}
