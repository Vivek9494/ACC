import { AUDIT_REDACTED_VALUE } from '@acc/types';
import type { Prisma } from '@prisma/client';

/**
 * Key suffixes (lower-cased) whose values must never reach the audit log.
 * Suffix matching keeps flags such as `awsKeyConfigured` and `tokenVersion` readable.
 */
const SECRET_KEY_SUFFIXES = [
  'password',
  'passwordhash',
  'hash',
  'token',
  'secret',
  'secretaccesskey',
  'apikey',
  'otp',
  'otpcode',
  'authorization',
  'cookie',
] as const;

export function isSecretAuditKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
  return SECRET_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

type JsonInput = Prisma.InputJsonValue | null;

function hasToJson(value: object): value is { toJSON(): unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

function redactValue(value: JsonInput | undefined): JsonInput | undefined {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: JsonInput) => redactValue(item) ?? null);
  }
  if (hasToJson(value)) {
    const json = value.toJSON();
    return typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean'
      ? json
      : String(json);
  }
  const out: Record<string, JsonInput> = {};
  for (const [key, child] of Object.entries(value as Prisma.InputJsonObject)) {
    if (child === undefined) {
      continue;
    }
    out[key] = isSecretAuditKey(key) ? AUDIT_REDACTED_VALUE : (redactValue(child) ?? null);
  }
  return out;
}

/** Deep copy of an audit payload with every secret-named key replaced by {@link AUDIT_REDACTED_VALUE}. */
export function redactAuditPayload(
  value: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return redactValue(value) ?? undefined;
}
