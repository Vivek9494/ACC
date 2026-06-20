import { isPasswordPolicyCompliant, PASSWORD_POLICY_INVALID_MESSAGE } from '@acc/types';
import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPasswordPolicy', async: false })
export class IsPasswordPolicyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isPasswordPolicyCompliant(value);
  }

  defaultMessage(): string {
    return PASSWORD_POLICY_INVALID_MESSAGE;
  }
}

/** Validates the shared password policy (min length, uppercase, special). */
export function IsPasswordPolicy(validationOptions?: ValidationOptions) {
  return function decorate(object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPasswordPolicyConstraint,
    });
  };
}
