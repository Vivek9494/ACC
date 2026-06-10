import {
  SIGNUP_FIELD_ORDER,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_VALIDATION_MESSAGES,
  allSignupValidationMessages,
  validateSignupConfirmPassword,
  validateSignupDateOfBirth,
  validateSignupEmail,
  validateSignupMobileNumber,
  validateSignupName,
  validateSignupPassword,
  validateSignupPostalCode,
  type SignupFieldKey,
} from '@acc/types';

export type { SignupFieldKey };

import type { ApiRequestError } from './api';

export type SignupFieldErrors = Partial<Record<SignupFieldKey, string>>;

export interface SignupFormValues {
  profilePhotoError: string | null;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  dateOfBirth: string;
  postalCode: string;
  province: string | null;
  centerId: string | null;
  password: string;
  confirmPassword: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
}

export function validateSignupForm(values: SignupFormValues): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  if (values.profilePhotoError) {
    errors.profilePhoto = values.profilePhotoError;
  }

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

  const dobError = validateSignupDateOfBirth(values.dateOfBirth);
  if (dobError) {
    errors.dateOfBirth = dobError;
  }

  const postalError = validateSignupPostalCode(values.postalCode);
  if (postalError) {
    errors.postalCode = postalError;
  }

  if (!values.province) {
    errors.province = SIGNUP_VALIDATION_MESSAGES.province.required;
  }

  if (!values.centerId) {
    errors.center = SIGNUP_VALIDATION_MESSAGES.center.required;
  }

  const passwordError = validateSignupPassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  const confirmError = validateSignupConfirmPassword(values.confirmPassword, values.password);
  if (confirmError) {
    errors.confirmPassword = confirmError;
  }

  const contactNameError = validateSignupName(
    values.emergencyContactName,
    SIGNUP_VALIDATION_MESSAGES.emergencyContactName,
  );
  if (contactNameError) {
    errors.emergencyContactName = contactNameError;
  }

  const contactNumberError = validateSignupMobileNumber(
    values.emergencyContactNumber,
    SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber,
  );
  if (contactNumberError) {
    errors.emergencyContactNumber = contactNumberError;
  }

  return errors;
}

export function firstSignupFieldError(errors: SignupFieldErrors): SignupFieldKey | null {
  for (const key of SIGNUP_FIELD_ORDER) {
    if (errors[key]) {
      return key;
    }
  }
  return null;
}

const KNOWN_SIGNUP_MESSAGES = new Set(allSignupValidationMessages());

export function mapApiErrorsToSignupFields(err: ApiRequestError): SignupFieldErrors {
  const raw = err.error.message;
  const messages = Array.isArray(raw) ? raw : [raw];
  const mapped: SignupFieldErrors = {};

  for (const message of messages) {
    if (!KNOWN_SIGNUP_MESSAGES.has(message)) {
      continue;
    }
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
    } else if (message === SIGNUP_VALIDATION_MESSAGES.postalCode.invalid) {
      mapped.postalCode = message;
    } else if (message === SIGNUP_VALIDATION_MESSAGES.center.required) {
      mapped.center = message;
    } else if (
      message === SIGNUP_VALIDATION_MESSAGES.password.required ||
      message === SIGNUP_VALIDATION_MESSAGES.password.invalid
    ) {
      mapped.password = message;
    } else if (
      message === SIGNUP_VALIDATION_MESSAGES.emergencyContactName.required ||
      message === SIGNUP_VALIDATION_MESSAGES.emergencyContactName.invalid ||
      message === SIGNUP_VALIDATION_MESSAGES.emergencyContactName.max
    ) {
      mapped.emergencyContactName = message;
    } else if (
      message === SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber.required ||
      message === SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber.invalid
    ) {
      mapped.emergencyContactNumber = message;
    }
  }

  return mapped;
}

export { SIGNUP_NAME_MAX_LENGTH };
