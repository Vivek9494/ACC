import { BadRequestException, type ValidationError } from '@nestjs/common';

/** Map DTO property names to mobile form field keys where they differ. */
const FIELD_ALIASES: Record<string, string> = {
  posterUrl: 'poster',
  profilePhotoUrl: 'profilePhoto',
};

function flattenValidationErrors(
  errors: ValidationError[],
  fields: Record<string, string>,
  prefix = '',
): void {
  for (const err of errors) {
    const property = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      const formKey = FIELD_ALIASES[property] ?? property;
      const message = Object.values(err.constraints)[0];
      if (message && !fields[formKey]) {
        fields[formKey] = message;
      }
    }
    if (err.children?.length) {
      flattenValidationErrors(err.children, fields, property);
    }
  }
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields: Record<string, string> = {};
  flattenValidationErrors(errors, fields);
  const messages = Object.values(fields);
  return new BadRequestException({
    message: messages.length === 1 ? messages[0] : 'Validation failed',
    error: 'VALIDATION_ERROR',
    fields,
  });
}
