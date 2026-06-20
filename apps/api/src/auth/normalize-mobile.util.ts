import { BadRequestException } from '@nestjs/common';
import { normalizeCanadianMobile, SIGNUP_VALIDATION_MESSAGES } from '@acc/types';

/** Normalize mobile input to E.164 (+1…) for DTO transforms; accepts 10-digit local or +1. */
export function normalizeMobileDto(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException({
      message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.required,
    });
  }
  try {
    return normalizeCanadianMobile(value);
  } catch {
    throw new BadRequestException({
      message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.invalid,
    });
  }
}
