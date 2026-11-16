import { Module } from '@nestjs/common';
import { ZeppController, ZeppPublicController } from './zepp.controller';
import { ZeppService } from './zepp.service';
@Module({ controllers: [ZeppController, ZeppPublicController], providers: [ZeppService] })
export class ZeppModule {}
