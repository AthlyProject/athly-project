import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  StreamableFile,
  Header,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user-rest.decorator';
import { UserModel } from '../users/models/user.model';
import { ZeppService } from './zepp.service';
class AuthorizeDto {
  @IsString() @MaxLength(100) timeZone: string;
}
class ResolveDto {
  @IsIn(['linked', 'free_run', 'dismissed']) resolution: string;
  @IsOptional() @IsString() workoutId?: string;
}
export class BackfillDto {
  @IsInt() @Min(0) startTime: number;
  @IsInt() @Min(0) endTime: number;
}
@Controller('zepp')
@UseGuards(JwtAuthGuard)
export class ZeppController {
  constructor(private readonly zepp: ZeppService) {}
  @Get('status') status(@CurrentUser() u: UserModel) {
    return this.zepp.status(u.id);
  }
  @Post('authorize') authorize(@CurrentUser() u: UserModel, @Body() b: AuthorizeDto) {
    return this.zepp.authorize(u.id, b.timeZone);
  }
  @Post('sync') sync(@CurrentUser() u: UserModel) {
    return this.zepp.requestSync(u.id);
  }
  @Delete('connection') disconnect(@CurrentUser() u: UserModel) {
    return this.zepp.disconnect(u.id);
  }
  @Get('activities/candidates')
  candidates(
    @CurrentUser() u: UserModel,
    @Query('workoutId') workoutId: string,
    @Query('startTime') start: string,
    @Query('endTime') end: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.zepp.candidates(u.id, workoutId, Number(start), Number(end), cursor);
  }
  @Get('activities') list(@CurrentUser() u: UserModel) {
    return this.zepp.activities(u.id);
  }
  @Post('activities/backfill')
  @HttpCode(202)
  backfill(@CurrentUser() u: UserModel, @Body() b: BackfillDto) {
    return this.zepp.requestBackfill(u.id, b.startTime, b.endTime);
  }
  @Get('activities/:id/fit')
  @Header('Cache-Control', 'no-store')
  async file(@CurrentUser() u: UserModel, @Param('id') id: string) {
    return new StreamableFile(await this.zepp.file(u.id, id), { type: 'application/octet-stream' });
  }
  @Post('activities/:id/resolve') resolve(
    @CurrentUser() u: UserModel,
    @Param('id') id: string,
    @Body() b: ResolveDto,
  ) {
    return this.zepp.resolve(u.id, id, b.resolution, b.workoutId);
  }
}
@Controller('zepp')
export class ZeppPublicController {
  constructor(private readonly zepp: ZeppService) {}
  @Get('callback')
  @Header('Cache-Control', 'no-store')
  callback(@Query('state') state: string, @Query('code') code?: string) {
    return this.zepp.callback(state, code);
  }
  @Post('webhooks/:secret')
  @HttpCode(200)
  webhook(@Param('secret') secret: string, @Body() body: unknown) {
    const expected = process.env.ZEPP_WEBHOOK_SECRET ?? '';
    if (
      expected.length < 32 ||
      Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    )
      throw new UnauthorizedException();
    return this.zepp.webhook(body);
  }
}
