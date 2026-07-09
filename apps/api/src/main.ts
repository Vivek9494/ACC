import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { registerProcessLifecycleHandlers } from './common/process-lifecycle';
import { validationExceptionFactory } from './common/validation/validation-pipe.factory';
import { resolveCorsOrigins } from './config/cors.config';
import { NodeEnv } from './config/env.validation';
import { resolveLogLevels } from './config/log-level';
import { CorsSocketIoAdapter } from './config/socket-io.adapter';

async function bootstrap(): Promise<void> {
  registerProcessLifecycleHandlers();

  const nodeEnv = (process.env.NODE_ENV as NodeEnv | undefined) ?? NodeEnv.Development;
  const logLevels = resolveLogLevels(nodeEnv, process.env.LOG_LEVEL);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.use(helmet());

  const runtimeConfig = app.get(ConfigService);
  const port = runtimeConfig.get<number>('PORT', 3001);
  const host = runtimeConfig.get<string>('HOST', '0.0.0.0');
  const runtimeNodeEnv = runtimeConfig.get<NodeEnv>('NODE_ENV', NodeEnv.Development);
  const corsOrigin = resolveCorsOrigins(
    runtimeNodeEnv,
    runtimeConfig.get<string>('CORS_ORIGINS'),
  );

  if (runtimeNodeEnv === NodeEnv.Development) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  }

  app.useWebSocketAdapter(
    new CorsSocketIoAdapter(app, corsOrigin, runtimeConfig.get<string>('REDIS_URL')),
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://${host}:${port}`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Failed to start API',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
