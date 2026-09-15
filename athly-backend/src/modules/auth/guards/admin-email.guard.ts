import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdminEmail } from '../../../common/admin-emails';
import { CodedForbiddenException } from '../../../common/errors/coded-exception';
import { ErrorCode } from '../../../common/errors/error-codes';

@Injectable()
export class AdminEmailGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email: string | undefined = request.user?.email;
    if (!isAdminEmail(email, this.config.get<string>('ADMIN_EMAILS'))) {
      throw new CodedForbiddenException(ErrorCode.AUTH_ADMIN_ACCESS_DENIED, 'Admin access denied');
    }
    return true;
  }
}
