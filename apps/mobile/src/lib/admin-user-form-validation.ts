import {
  AuthErrorCode,
  EMAIL_EXISTS_MESSAGE,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  SIGNUP_VALIDATION_MESSAGES,
  allSignupValidationMessages,
  validateSignupDateOfBirth,
  validateSignupEmail,
  validateSignupMobileNumber,
  validateSignupName,
} from '@acc/types';

import type { ApiRequestError } from './api';
import { validateJerseyName, validateJerseyNumber } from './profile-form-validation';

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
  'firstName',
  'lastName',
  'mobileNumber',
  'email',
  'province',
  'center',
  'dateOfBirth',
  'jerseyNumber',
  'jerseyName',
];

export interface AdminUserCreateFormValues {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
}

export interface AdminUserEditFormValues extends AdminUserCreateFormValues {
  provinceId: string | null;
  centerId: string | null;
  jerseyNumber: string;
  jerseyName: string;
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

  if (!values.provinceId) {
    errors.province = SIGNUP_VALIDATION_MESSAGES.province.required;
  }

  if (!values.centerId) {
    errors.center = SIGNUP_VALIDATION_MESSAGES.center.required;
  }

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
  if (
    message === SIGNUP_VALIDATION_MESSAGES.firstName.required ||
    message === SIGNUP_VALIDATION_MESSAGES.firstName.invalid ||
    message === SIGNUP_VALIDATION_MESSAGES.firstName.max
  ) {
    mapped.firstName = message;
  } else if (
    message === SIGNUP_VALIDATION_MESSAGES.lastName.required ||
    message === SIGNUP_VALIDATION_MESSAGES.lastName.invalid ||
    message === SIGNUP_VALIDATION_MESSAGES.lastName.max
  ) {
    mapped.lastName = message;
  } else if (
    message === SIGNUP_VALIDATION_MESSAGES.mobileNumber.required ||
    message === SIGNUP_VALIDATION_MESSAGES.mobileNumber.invalid
  ) {
    mapped.mobileNumber = message;
  } else if (message === SIGNUP_VALIDATION_MESSAGES.email.invalid) {
    mapped.email = message;
  } else if (
    message === SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required ||
    message === SIGNUP_VALIDATION_MESSAGES.dateOfBirth.underage
  ) {
    mapped.dateOfBirth = message;
  } else if (message === SIGNUP_VALIDATION_MESSAGES.province.required) {
    mapped.province = message;
  } else if (message === SIGNUP_VALIDATION_MESSAGES.center.required) {
    mapped.center = message;
  }
}

export function mapApiErrorsToAdminUserFields(err: ApiRequestError): AdminUserFieldErrors {
  const mapped: AdminUserFieldErrors = {};

  if (err.error.code === AuthErrorCode.MobileNumberExists) {
    mapped.mobileNumber = MOBILE_NUMBER_EXISTS_MESSAGE;
  }
  if (err.error.code === AuthErrorCode.EmailExists) {
    mapped.email = EMAIL_EXISTS_MESSAGE;
  }
  if (err.error.code === AuthErrorCode.InvalidCenter) {
    mapped.center = 'Invalid or inactive center';
  }

  const raw = err.error.message;
  const messages = Array.isArray(raw) ? raw : [raw];
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
