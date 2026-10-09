import { Module } from '@nestjs/common';
import { HeartRateHealthService } from './heart-rate-health.service';

@Module({ providers: [HeartRateHealthService], exports: [HeartRateHealthService] })
export class HeartRateModule {}
