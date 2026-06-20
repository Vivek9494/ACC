/** Minimum password length enforced app-wide (§31 security mitigation). */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
/** Non-alphanumeric characters count as special. */
export const PASSWORD_SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export type PasswordPolicyRuleId = 'minLength' | 'uppercase' | 'special';

export interface PasswordPolicyRule {
  id: PasswordPolicyRuleId;
  label: string;
}

/** Checklist rows — keep in sync with {@link isPasswordPolicyCompliant}. */
export const PASSWORD_POLICY_RULES: readonly PasswordPolicyRule[] = [
  { id: 'minLength', label: 'At least 8 characters long' },
  { id: 'special', label: 'Must include a special character' },
  { id: 'uppercase', label: 'At least one uppercase letter' },
] as const;

export type PasswordPolicyChecks = Record<PasswordPolicyRuleId, boolean>;

export function passwordPolicyChecks(password: string): PasswordPolicyChecks {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: PASSWORD_UPPERCASE_REGEX.test(password),
    special: PASSWORD_SPECIAL_CHAR_REGEX.test(password),
  };
}

export function isPasswordPolicyCompliant(password: string): boolean {
  const checks = passwordPolicyChecks(password);
  return PASSWORD_POLICY_RULES.every((rule) => checks[rule.id]);
}

export const PASSWORD_POLICY_INVALID_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter and a special character';

export const CHANGE_PASSWORD_MESSAGES = {
  currentRequired: 'Current password is required',
  currentIncorrect: 'Current password is incorrect',
  sameAsCurrent: 'New password must be different from your current password',
  confirmMismatch: 'Passwords do not match',
} as const;
