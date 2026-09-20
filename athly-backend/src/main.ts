import './otel-init';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/errors/validation-exception.factory';
import { SWAGGER_DOCS_PATHS, docsBasicAuth } from './common/docs-basic-auth';
import { OTelLoggerService } from './otel-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new OTelLoggerService());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const docsUser = process.env.SWAGGER_DOCS_USER?.trim() || 'athly';
  const docsPassword = process.env.SWAGGER_DOCS_PASSWORD?.trim() || 'athly';

  if (process.env.NODE_ENV === 'production') {
    for (const path of SWAGGER_DOCS_PATHS) {
      app.use(path, docsBasicAuth(docsUser, docsPassword));
    }
  }

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 4000);
}

function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('IAFit API')
    .setDescription('IAFit Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}

void bootstrap();
