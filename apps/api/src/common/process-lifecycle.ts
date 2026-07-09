import { Logger } from '@nestjs/common';

/** Registers process-level handlers so fatal errors are logged before exit. */
export function registerProcessLifecycleHandlers(logger = new Logger('ProcessLifecycle')): void {
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
      'Unhandled promise rejection',
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception — shutting down', err.stack);
    process.exit(1);
  });
}
