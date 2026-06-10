import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const host = '0.0.0.0';

  // Reflect the request origin so Expo Go on a physical device (any LAN IP) can call the API.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://${host}:${port}`);
}

void bootstrap();
