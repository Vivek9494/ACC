import 'reflect-metadata';

import { NodeEnv, validateEnv } from './env.validation';

const baseConfig = {
  DATABASE_URL: 'postgresql://acc:acc@localhost:5435/acc',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

const productionIntegrations = {
  // Non-SID-shaped placeholders — GitHub push protection flags AC + 32 hex patterns.
  TWILIO_ACCOUNT_SID: 'test-twilio-account-sid-local-only',
  TWILIO_AUTH_TOKEN: 'test-twilio-auth-token-local-only',
  TWILIO_FROM_NUMBER: '+15550000000',
  AWS_S3_BUCKET: 'acc-media',
  AWS_REGION: 'ca-central-1',
  AWS_ACCESS_KEY_ID: 'test-aws-access-key-id-local-only',
  AWS_SECRET_ACCESS_KEY: 'test-aws-secret-access-key-local-only',
  FCM_PROJECT_ID: 'acc-prod',
  FCM_CLIENT_EMAIL: 'firebase-adminsdk@acc-prod.iam.gserviceaccount.com',
  FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
  CORS_ORIGINS: 'https://api.example.com,https://admin.example.com',
};

describe('validateEnv', () => {
  it('accepts minimal development config', () => {
    expect(validateEnv({ ...baseConfig, NODE_ENV: NodeEnv.Development })).toMatchObject({
      NODE_ENV: NodeEnv.Development,
    });
  });

  it('rejects production when integrations are missing', () => {
    expect(() =>
      validateEnv({ ...baseConfig, NODE_ENV: NodeEnv.Production }),
    ).toThrow(/Production environment requires:/);
  });

  it('accepts production when all integrations and CORS are set', () => {
    expect(
      validateEnv({
        ...baseConfig,
        ...productionIntegrations,
        NODE_ENV: NodeEnv.Production,
      }),
    ).toMatchObject({
      NODE_ENV: NodeEnv.Production,
      CORS_ORIGINS: productionIntegrations.CORS_ORIGINS,
    });
  });

  it('rejects production with empty CORS_ORIGINS', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        ...productionIntegrations,
        CORS_ORIGINS: '  ,  ',
        NODE_ENV: NodeEnv.Production,
      }),
    ).toThrow(/CORS_ORIGINS must list at least one origin/);
  });
});
