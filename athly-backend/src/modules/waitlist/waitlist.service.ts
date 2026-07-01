import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWaitlistEntryDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('Este email já está na lista de espera.');
    }

    const entry = await this.prisma.waitlistEntry.create({
      data: {
        name: dto.name.trim(),
        email,
      },
    });

    return {
      id: entry.id,
      name: entry.name,
      email: entry.email,
      createdAt: entry.createdAt,
    };
  }
}
