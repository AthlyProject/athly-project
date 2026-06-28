import { Injectable } from '@nestjs/common';
import { OTelLoggerService } from './otel-logger.service';

const logger = new OTelLoggerService();

@Injectable()
export class AppService {
  getHello(): string {
    logger.log('Hello World!', AppService.name);
    return 'Hello World!';
  }
}
