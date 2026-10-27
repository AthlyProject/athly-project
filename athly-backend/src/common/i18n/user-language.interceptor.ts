import { Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { normalizeLanguage } from './user-language';

@Injectable()
export class UserLanguageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UserLanguageInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string; language?: string | null } }>();
    const raw = request.headers['x-athly-language'] ?? request.headers['accept-language'];
    // Older clients must not erase a preference learned from the app.
    if (!request.user || raw === undefined) return next.handle();

    const language = normalizeLanguage(Array.isArray(raw) ? raw.join(',') : raw);
    if (request.user.language !== language) {
      try {
        await this.prisma.user.update({ where: { id: request.user.id }, data: { language } });
        request.user.language = language;
      } catch (error) {
        this.logger.warn(
          `Could not persist language for user ${request.user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return next.handle();
  }
}
