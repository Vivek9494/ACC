import type { LogLevel } from '@nestjs/common';

import { NodeEnv } from './env.validation';

/** Maps LOG_LEVEL env to Nest logger levels; production defaults to warn+error only. */
export function resolveLogLevels(nodeEnv: NodeEnv, logLevelRaw?: string): LogLevel[] {
  const level = logLevelRaw?.trim().toLowerCase();

  if (level === 'debug') {
    return ['log', 'error', 'warn', 'debug', 'verbose'];
  }
  if (level === 'verbose') {
    return ['log', 'error', 'warn', 'debug', 'verbose'];
  }
  if (level === 'log') {
    return ['log', 'error', 'warn'];
  }
  if (level === 'warn') {
    return ['error', 'warn'];
  }
  if (level === 'error') {
    return ['error'];
  }

  if (nodeEnv === NodeEnv.Production) {
    return ['error', 'warn', 'log'];
  }

  return ['log', 'error', 'warn', 'debug', 'verbose'];
}
