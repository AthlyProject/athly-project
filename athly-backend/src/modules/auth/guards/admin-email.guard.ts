import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdminEmail } from '../../../common/admin-emails';

@Injectable()
export class AdminEmailGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email: string | undefined = request.user?.email;
    if (!isAdminEmail(email, this.config.get<string>('ADMIN_EMAILS'))) {
      throw new ForbiddenException('Admin access denied');
    }
    return true;
  }
}
