import { Logger } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT = 3001;

  /** HTTP bind address; 0.0.0.0 allows Expo Go on a physical device on the same LAN. */
  @IsOptional()
  @IsString()
  HOST?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET!: string;

  /** Access token lifetime, e.g. "15m" or "1h". */
  @IsString()
  JWT_ACCESS_TTL = '1h';

  /** Comma-separated allowed HTTP/WebSocket origins in production (e.g.
   * `https://admin.example.com,https://api.example.com`). Ignored in development
   * where any origin is accepted for Expo Go on LAN.
   */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Nest log level: error | warn | log | debug | verbose. Production defaults to log. */
  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  /**
   * Comma-separated integrations permitted to run with dev-style console stubs
   * in production during a phased rollout, e.g. `TWILIO,FCM`. Stubbed
   * integrations log instead of delivering (OTPs / push are NOT sent). AWS S3
   * and CORS cannot be stubbed. Leave unset to require all integrations.
   */
  @IsOptional()
  @IsString()
  ALLOW_STUBBED_INTEGRATIONS?: string;

  // Twilio (optional in dev). Required in production — otherwise OTPs would be
  // logged to stdout via the console stub.
  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN?: string;

  @IsOptional()
  @IsString()
  TWILIO_FROM_NUMBER?: string;

  /** AWS S3 bucket for all media (ca-central-1). Required in production. */
  @IsOptional()
  @IsString()
  AWS_S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  AWS_REGION?: string;

  /** Optional S3-compatible endpoint (MinIO local dev). */
  @IsOptional()
  @IsString()
  AWS_S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  AWS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string;

  /** Dev-only: base URL for locally served uploads when S3 is not configured. */
  @IsOptional()
  @IsString()
  PUBLIC_API_URL?: string;

  /** Google Places / Geocoding API key (server-side proxy only). */
  @IsOptional()
  @IsString()
  GOOGLE_PLACES_KEY?: string;

  // Firebase Cloud Messaging service account (optional in dev). Required in
  // production. Reuses the locked FCM stack (§29).
  @IsOptional()
  @IsString()
  FCM_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FCM_CLIENT_EMAIL?: string;

  /** PEM private key; newlines may be escaped as \n in the env value. */
  @IsOptional()
  @IsString()
  FCM_PRIVATE_KEY?: string;
}

const PRODUCTION_REQUIRED_STRINGS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'AWS_S3_BUCKET',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'FCM_PROJECT_ID',
  'FCM_CLIENT_EMAIL',
  'FCM_PRIVATE_KEY',
  'CORS_ORIGINS',
] as const satisfies readonly (keyof EnvironmentVariables)[];

/** Integrations that ship with a console fallback and may be stubbed in prod. */
export enum StubbableIntegration {
  Twilio = 'TWILIO',
  Fcm = 'FCM',
}

/** Env keys covered by each stubbable integration (excluded from prod checks when stubbed). */
const STUBBABLE_INTEGRATION_KEYS: Record<
  StubbableIntegration,
  readonly (keyof EnvironmentVariables)[]
> = {
  [StubbableIntegration.Twilio]: [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_NUMBER',
  ],
  [StubbableIntegration.Fcm]: ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'],
};

/** Parse the ALLOW_STUBBED_INTEGRATIONS list into a validated set. */
export function parseStubbedIntegrations(raw: string | undefined): Set<StubbableIntegration> {
  const result = new Set<StubbableIntegration>();
  if (!raw) {
    return result;
  }
  for (const token of raw.split(',').map((part) => part.trim().toUpperCase())) {
    if (token === StubbableIntegration.Twilio || token === StubbableIntegration.Fcm) {
      result.add(token);
    }
  }
  return result;
}

function assertProductionIntegrations(env: EnvironmentVariables): void {
  if (env.NODE_ENV !== NodeEnv.Production) {
    return;
  }

  const stubbed = parseStubbedIntegrations(env.ALLOW_STUBBED_INTEGRATIONS);
  const excluded = new Set<keyof EnvironmentVariables>();
  for (const integration of stubbed) {
    for (const key of STUBBABLE_INTEGRATION_KEYS[integration]) {
      excluded.add(key);
    }
  }

  const missing = PRODUCTION_REQUIRED_STRINGS.filter((key) => {
    if (excluded.has(key)) {
      return false;
    }
    const value = env[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Production environment requires: ${missing.join(', ')}. Dev-only console fallbacks are disabled in production.`,
    );
  }

  if (stubbed.size > 0) {
    new Logger('EnvValidation').warn(
      `Running in production with STUBBED integrations: ${[...stubbed].join(', ')}. ` +
        'These will log instead of delivering (OTPs / push are NOT sent). Set real ' +
        'credentials and remove ALLOW_STUBBED_INTEGRATIONS before going live.',
    );
  }

  const corsOrigins = env.CORS_ORIGINS!.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must list at least one origin in production.');
  }
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }

  assertProductionIntegrations(validated);

  return validated;
}
