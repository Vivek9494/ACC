import { randomBytes } from 'node:crypto';

import { isPasswordPolicyCompliant } from '@acc/types';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*-_=+';
const ALL = LOWER + UPPER + DIGITS + SPECIAL;

const DEFAULT_TEMP_PASSWORD_LENGTH = 16;

function pickChar(pool: string): string {
  const index = randomBytes(1)[0]! % pool.length;
  return pool.charAt(index);
}

/** Fisher–Yates shuffle using CSPRNG indices. */
function shuffle(chars: string[]): string[] {
  const result = [...chars];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Generates a random password that satisfies the shared policy (length, uppercase,
 * special). Uses `crypto.randomBytes` — not guessable or sequential.
 */
export function generateSecureTemporaryPassword(
  length: number = DEFAULT_TEMP_PASSWORD_LENGTH,
): string {
  if (length < 8) {
    throw new Error('Temporary password length must be at least 8');
  }

  let password = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const required = [pickChar(UPPER), pickChar(LOWER), pickChar(DIGITS), pickChar(SPECIAL)];
    const rest: string[] = [];
    const bytes = randomBytes(length - required.length);
    for (const byte of bytes) {
      rest.push(pickChar(ALL));
    }
    password = shuffle([...required, ...rest]).join('');
    if (isPasswordPolicyCompliant(password)) {
      return password;
    }
  }

  throw new Error('Failed to generate a policy-compliant temporary password');
}
