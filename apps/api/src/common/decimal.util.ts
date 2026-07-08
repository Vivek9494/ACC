import { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

/** Converts a Prisma Decimal column to a JS number for API responses. */
export function decimalToNumberOrNull(value: Decimal | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return value.toNumber();
}

/** Converts an optional dollar amount to Prisma Decimal for persistence. */
export function numberToDecimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null) {
    return null;
  }
  return new Prisma.Decimal(value);
}
