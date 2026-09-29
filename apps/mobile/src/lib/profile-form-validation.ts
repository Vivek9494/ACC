import {
  JERSEY_SIZE_OPTIONS,
  SIGNUP_VALIDATION_MESSAGES,
  validateSignupDateOfBirth,
  validateSignupEmail,
  validateSignupMobileNumber,
  validateSignupName,
  validateSignupPostalCode,
  validateJerseyName,
  validateJerseyNumber,
  type JerseySize,
} from '@acc/types';

export type ProfileFieldKey =
  | 'profilePhoto'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'dateOfBirth'
  | 'postalCode'
  | 'province'
  | 'center'
  | 'emergencyContactName'
  | 'emergencyContactNumber'
  | 'jerseyName'
  | 'jerseyNumber';

export type ProfileFieldErrors = Partial<Record<ProfileFieldKey, string>>;

export interface ProfileFormValues {
  profilePhotoError: string | null;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  postalCode: string;
  provinceId: string | null;
  centerId: string | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  jerseyName: string;
  jerseyNumber: string;
}

export { validateJerseyName, validateJerseyNumber };

export function validateProfileForm(values: ProfileFormValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

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

  if (!values.provinceId) {
    errors.province = SIGNUP_VALIDATION_MESSAGES.province.required;
  }

  if (!values.centerId) {
    errors.center = SIGNUP_VALIDATION_MESSAGES.center.required;
  }

  const emergencyNameError = validateSignupName(
    values.emergencyContactName,
    SIGNUP_VALIDATION_MESSAGES.emergencyContactName,
  );
  if (emergencyNameError) {
    errors.emergencyContactName = emergencyNameError;
  }

  const emergencyNumberError = validateSignupMobileNumber(
    values.emergencyContactNumber,
    SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber,
  );
  if (emergencyNumberError) {
    errors.emergencyContactNumber = emergencyNumberError;
  }

  const jerseyNameError = validateJerseyName(values.jerseyName);
  if (jerseyNameError) {
    errors.jerseyName = jerseyNameError;
  }

  const jerseyNumberError = validateJerseyNumber(values.jerseyNumber);
  if (jerseyNumberError) {
    errors.jerseyNumber = jerseyNumberError;
  }

  return errors;
}

export function isJerseySizeValue(value: string | null): value is JerseySize {
  return value !== null && (JERSEY_SIZE_OPTIONS as readonly string[]).includes(value);
}
