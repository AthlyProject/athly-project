import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminEmailGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email: string | undefined = request.user?.email;
    if (!email) {
      throw new ForbiddenException('Admin access denied');
    }

    const raw = this.config.get<string>('ADMIN_EMAILS', '');
    const allowed = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (!allowed.includes(email.toLowerCase())) {
      throw new ForbiddenException('Admin access denied');
    }
    return true;
  }
}
