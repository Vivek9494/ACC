import { Prisma } from '@prisma/client';

type AuditScalar = string | number | boolean | null;

function toAuditScalar(value: unknown): AuditScalar | Prisma.InputJsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toAuditScalar(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, AuditScalar | Prisma.InputJsonValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = toAuditScalar(nested);
    }
    return out;
  }
  return String(value);
}

/** JSON-safe copy of `keys` from `row` (Dates → ISO, Decimals → numbers). */
export function auditSnapshot<T extends object, K extends keyof T & string>(
  row: T,
  keys: readonly K[],
): Prisma.InputJsonObject {
  const out: Record<string, AuditScalar | Prisma.InputJsonValue> = {};
  for (const key of keys) {
    out[key] = toAuditScalar(row[key]);
  }
  return out;
}

/** Keys whose snapshot values differ between `before` and `after`. */
export function changedAuditKeys(
  before: Prisma.InputJsonObject,
  after: Prisma.InputJsonObject,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
  );
}

/** Restricts both snapshots to changed keys; returns null when nothing changed. */
export function auditDiff(
  before: Prisma.InputJsonObject,
  after: Prisma.InputJsonObject,
): { before: Prisma.InputJsonObject; after: Prisma.InputJsonObject; changed: string[] } | null {
  const changed = changedAuditKeys(before, after);
  if (changed.length === 0) return null;
  const pick = (source: Prisma.InputJsonObject): Prisma.InputJsonObject => {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const key of changed) out[key] = source[key] ?? null;
    return out;
  };
  return { before: pick(before), after: pick(after), changed };
}
