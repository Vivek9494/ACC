import { AuthErrorCode, EMAIL_EXISTS_MESSAGE, MOBILE_NUMBER_EXISTS_MESSAGE } from './auth';
import {
  SIGNUP_VALIDATION_MESSAGES,
  allSignupValidationMessages,
  validateSignupDateOfBirth,
  validateSignupEmail,
  validateSignupMobileNumber,
  validateSignupName,
} from './signup-validation';

/**
 * Client-side validation for the Admin Add User / Edit User forms, shared by the
 * mobile app and the web admin dashboard. Mirrors the api DTO rules.
 */

export type AdminUserFieldKey =
  | 'firstName'
  | 'lastName'
  | 'mobileNumber'
  | 'email'
  | 'province'
  | 'center'
  | 'dateOfBirth'
  | 'jerseyNumber'
  | 'jerseyName';

export type AdminUserFieldErrors = Partial<Record<AdminUserFieldKey, string>>;

export const ADMIN_USER_CREATE_FIELD_ORDER: AdminUserFieldKey[] = [
  'firstName',
  'lastName',
  'mobileNumber',
  'email',
  'province',
  'center',
  'dateOfBirth',
];

export const ADMIN_USER_EDIT_FIELD_ORDER: AdminUserFieldKey[] = [
  ...ADMIN_USER_CREATE_FIELD_ORDER,
  'jerseyNumber',
  'jerseyName',
];

export interface AdminUserCreateFormValues {
  firstName: string;
  lastName: string;
  /** 10 local digits. */
  mobileNumber: string;
  email: string;
  /** YYYY-MM-DD, or empty (optional on create). */
  dateOfBirth: string;
  provinceId: string | null;
  centerId: string | null;
}

export interface AdminUserEditFormValues extends AdminUserCreateFormValues {
  jerseyNumber: string;
  jerseyName: string;
}

export function validateJerseyName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return validateSignupName(trimmed, SIGNUP_VALIDATION_MESSAGES.firstName);
}

export function validateJerseyNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'Enter a valid jersey number';
  }
  const num = Number(trimmed);
  if (num < 0 || num > 999) {
    return 'Jersey number must be between 0 and 999';
  }
  return null;
}

export function validateAdminUserCreateForm(
  values: AdminUserCreateFormValues,
): AdminUserFieldErrors {
  const errors: AdminUserFieldErrors = {};

  const firstNameError = validateSignupName(
    values.firstName,
    SIGNUP_VALIDATION_MESSAGES.firstName,
  );
  if (firstNameError) {
    errors.firstName = firstNameError;
  }

  const lastNameError = validateSignupName(values.lastName, SIGNUP_VALIDATION_MESSAGES.lastName);
  if (lastNameError) {
    errors.lastName = lastNameError;
  }

  const mobileError = validateSignupMobileNumber(
    values.mobileNumber,
    SIGNUP_VALIDATION_MESSAGES.mobileNumber,
  );
  if (mobileError) {
    errors.mobileNumber = mobileError;
  }

  const emailError = validateSignupEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (!values.provinceId) {
    errors.province = SIGNUP_VALIDATION_MESSAGES.province.required;
  }

  if (!values.centerId) {
    errors.center = SIGNUP_VALIDATION_MESSAGES.center.required;
  }

  if (values.dateOfBirth.trim()) {
    const dobError = validateSignupDateOfBirth(values.dateOfBirth);
    if (dobError) {
      errors.dateOfBirth = dobError;
    }
  }

  return errors;
}

export function validateAdminUserEditForm(
  values: AdminUserEditFormValues,
): AdminUserFieldErrors {
  const errors = validateAdminUserCreateForm(values);

  if (!values.dateOfBirth.trim()) {
    errors.dateOfBirth = SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required;
  }

  const jerseyNumberError = validateJerseyNumber(values.jerseyNumber);
  if (jerseyNumberError) {
    errors.jerseyNumber = jerseyNumberError;
  }

  const jerseyNameError = validateJerseyName(values.jerseyName);
  if (jerseyNameError) {
    errors.jerseyName = jerseyNameError;
  }

  return errors;
}

export function firstAdminUserFieldError(
  errors: AdminUserFieldErrors,
  order: readonly AdminUserFieldKey[],
): AdminUserFieldKey | null {
  for (const key of order) {
    if (errors[key]) {
      return key;
    }
  }
  return null;
}

const KNOWN_SIGNUP_MESSAGES = new Set(allSignupValidationMessages());

function mapKnownValidationMessage(message: string, mapped: AdminUserFieldErrors): void {
  const m = SIGNUP_VALIDATION_MESSAGES;
  if (
    message === m.firstName.required ||
    message === m.firstName.invalid ||
    message === m.firstName.max
  ) {
    mapped.firstName = message;
  } else if (
    message === m.lastName.required ||
    message === m.lastName.invalid ||
    message === m.lastName.max
  ) {
    mapped.lastName = message;
  } else if (message === m.mobileNumber.required || message === m.mobileNumber.invalid) {
    mapped.mobileNumber = message;
  } else if (message === m.email.invalid) {
    mapped.email = message;
  } else if (message === m.dateOfBirth.required || message === m.dateOfBirth.underage) {
    mapped.dateOfBirth = message;
  } else if (message === m.province.required) {
    mapped.province = message;
  } else if (message === m.center.required) {
    mapped.center = message;
  }
}

/** Maps an api error (code + message list) onto the form fields it concerns. */
export function mapAdminUserApiErrorToFields(error: {
  code?: string;
  message: string | readonly string[];
}): AdminUserFieldErrors {
  const mapped: AdminUserFieldErrors = {};

  if (error.code === AuthErrorCode.MobileNumberExists) {
    mapped.mobileNumber = MOBILE_NUMBER_EXISTS_MESSAGE;
  }
  if (error.code === AuthErrorCode.EmailExists) {
    mapped.email = EMAIL_EXISTS_MESSAGE;
  }
  if (error.code === AuthErrorCode.InvalidCenter) {
    mapped.center = 'Invalid or inactive center';
  }

  const messages = typeof error.message === 'string' ? [error.message] : error.message;
  for (const message of messages) {
    if (message === MOBILE_NUMBER_EXISTS_MESSAGE) {
      mapped.mobileNumber = message;
    } else if (message === EMAIL_EXISTS_MESSAGE) {
      mapped.email = message;
    } else if (KNOWN_SIGNUP_MESSAGES.has(message)) {
      mapKnownValidationMessage(message, mapped);
    }
  }

  return mapped;
}
