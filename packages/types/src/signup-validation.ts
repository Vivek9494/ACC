import { MIN_SIGNUP_AGE, PASSWORD_MIN_LENGTH } from './auth';
import {
  isPasswordPolicyCompliant,
  PASSWORD_POLICY_INVALID_MESSAGE,
} from './password-policy';
import { CANADIAN_POSTAL_CODE_REGEX } from './postal-code';

export const SIGNUP_NAME_MAX_LENGTH = 40;
export const SIGNUP_ADDRESS_MAX_LENGTH = 200;
export const SIGNUP_MOBILE_LENGTH = 10;
export const SIGNUP_PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Strip XSS / control characters while typing. Does not remove other disallowed
 * punctuation — those fail {@link validateSignupName} on submit.
 */
export const SIGNUP_NAME_UNSAFE_CHARS_REGEX = /[<>\u0000-\u001F\u007F-\u009F]/g;

/**
 * Personal names: Unicode letters and marks, spaces, apostrophes (' and ’),
 * hyphens, periods, and parentheses. Used by client + server validators.
 */
export const SIGNUP_NAME_REGEX = /^[\p{L}\p{M} '\u2019().\-]+$/u;

/** Exactly ten digits (Canadian local mobile without country code). */
export const SIGNUP_MOBILE_REGEX = /^\d{10}$/;

export const SIGNUP_VALIDATION_MESSAGES = {
  profilePhoto: {
    type: 'Profile photo must be a JPG image',
    size: 'Profile photo must be under 5MB',
  },
  firstName: {
    required: 'First name is required',
    invalid: "Use letters, spaces, and common punctuation only (' - . ( ))",
    max: `Max ${SIGNUP_NAME_MAX_LENGTH} characters`,
  },
  lastName: {
    required: 'Last name is required',
    invalid: "Use letters, spaces, and common punctuation only (' - . ( ))",
    max: `Max ${SIGNUP_NAME_MAX_LENGTH} characters`,
  },
  mobileNumber: {
    required: 'Mobile number is required',
    invalid: 'Enter a valid 10-digit mobile number',
  },
  email: {
    invalid: 'Enter a valid email address',
  },
  dateOfBirth: {
    required: 'Date of birth is required',
    underage: 'You must be at least 18 years old',
  },
  postalCode: {
    invalid: 'Enter a valid postal code',
  },
  province: {
    required: 'Please select a province',
  },
  center: {
    required: 'Please select a center',
  },
  password: {
    required: 'Password is required',
    invalid: PASSWORD_POLICY_INVALID_MESSAGE,
  },
  confirmPassword: {
    required: 'Please confirm your password',
    mismatch: 'Passwords do not match',
  },
  emergencyContactName: {
    required: 'Contact name is required',
    invalid: "Use letters, spaces, and common punctuation only (' - . ( ))",
    max: `Max ${SIGNUP_NAME_MAX_LENGTH} characters`,
  },
  emergencyContactNumber: {
    required: 'Contact number is required',
    invalid: 'Enter a valid 10-digit mobile number',
  },
} as const;

export type SignupFieldKey =
  | 'profilePhoto'
  | 'firstName'
  | 'lastName'
  | 'mobileNumber'
  | 'email'
  | 'dateOfBirth'
  | 'address'
  | 'postalCode'
  | 'province'
  | 'center'
  | 'password'
  | 'confirmPassword'
  | 'emergencyContactName'
  | 'emergencyContactNumber';

/** Visual order on the signup screen (used to scroll to the first error). */
export const SIGNUP_FIELD_ORDER: SignupFieldKey[] = [
  'profilePhoto',
  'firstName',
  'lastName',
  'mobileNumber',
  'email',
  'dateOfBirth',
  'address',
  'postalCode',
  'province',
  'center',
  'password',
  'confirmPassword',
  'emergencyContactName',
  'emergencyContactNumber',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageInYears(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatSignupNameInput(input: string): string {
  return input.replace(SIGNUP_NAME_UNSAFE_CHARS_REGEX, '').slice(0, SIGNUP_NAME_MAX_LENGTH);
}

export function isSignupNameValid(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > SIGNUP_NAME_MAX_LENGTH) {
    return false;
  }
  if (SIGNUP_NAME_UNSAFE_CHARS_REGEX.test(trimmed)) {
    return false;
  }
  return SIGNUP_NAME_REGEX.test(trimmed);
}

export function formatSignupMobileInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, SIGNUP_MOBILE_LENGTH);
}

export function formatSignupAddressInput(input: string): string {
  return input.slice(0, SIGNUP_ADDRESS_MAX_LENGTH);
}

export function validateSignupName(
  value: string,
  messages: {
    required: string;
    invalid: string;
    max: string;
  },
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return messages.required;
  }
  if (trimmed.length > SIGNUP_NAME_MAX_LENGTH) {
    return messages.max;
  }
  if (!isSignupNameValid(trimmed)) {
    return messages.invalid;
  }
  return null;
}

export function validateSignupMobileNumber(
  value: string,
  messages: { required: string; invalid: string },
): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return messages.required;
  }
  if (!SIGNUP_MOBILE_REGEX.test(digits)) {
    return messages.invalid;
  }
  return null;
}

export function validateSignupEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!EMAIL_RE.test(trimmed)) {
    return SIGNUP_VALIDATION_MESSAGES.email.invalid;
  }
  return null;
}

export function validateSignupDateOfBirth(value: string): string | null {
  if (!value.trim()) {
    return SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required;
  }
  if (!DATE_RE.test(value)) {
    return SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required;
  }
  const dob = new Date(value);
  if (ageInYears(dob, new Date()) < MIN_SIGNUP_AGE) {
    return SIGNUP_VALIDATION_MESSAGES.dateOfBirth.underage;
  }
  return null;
}

export function validateSignupPostalCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!CANADIAN_POSTAL_CODE_REGEX.test(trimmed)) {
    return SIGNUP_VALIDATION_MESSAGES.postalCode.invalid;
  }
  return null;
}

export function validateSignupPassword(value: string): string | null {
  if (!value) {
    return SIGNUP_VALIDATION_MESSAGES.password.required;
  }
  if (!isPasswordPolicyCompliant(value)) {
    return SIGNUP_VALIDATION_MESSAGES.password.invalid;
  }
  return null;
}

export function validateSignupConfirmPassword(
  value: string,
  password: string,
): string | null {
  if (!value) {
    return SIGNUP_VALIDATION_MESSAGES.confirmPassword.required;
  }
  if (value !== password) {
    return SIGNUP_VALIDATION_MESSAGES.confirmPassword.mismatch;
  }
  return null;
}

export function isAllowedSignupProfilePhotoMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  const normalized = mimeType.toLowerCase();
  return normalized === 'image/jpeg' || normalized === 'image/jpg';
}

export function isAllowedSignupProfilePhotoSize(fileSize: number | null | undefined): boolean {
  return (fileSize ?? 0) > 0 && (fileSize ?? 0) <= SIGNUP_PROFILE_PHOTO_MAX_BYTES;
}

/** Collect every known signup validation message for API error mapping. */
export function allSignupValidationMessages(): string[] {
  const messages: string[] = [];
  for (const group of Object.values(SIGNUP_VALIDATION_MESSAGES)) {
    for (const message of Object.values(group)) {
      messages.push(message);
    }
  }
  return messages;
}
