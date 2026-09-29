import {
  AuthErrorCode,
  CHANGE_PASSWORD_MESSAGES,
  PASSWORD_POLICY_RULES,
  passwordPolicyChecks,
} from '@acc/types';
import { Check, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { FormField } from './FormField';
import { useChangePassword } from './settings-api';
import {
  EMPTY_CHANGE_PASSWORD,
  PASSWORD_CHANGED_NOTICE,
  validateChangePassword,
  type ChangePasswordErrors,
  type ChangePasswordValues,
} from './settings';

export function ChangePasswordCard(): React.ReactElement {
  const { endSession } = useAuth();
  const changePassword = useChangePassword();
  const [values, setValues] = useState<ChangePasswordValues>(EMPTY_CHANGE_PASSWORD);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const checks = passwordPolicyChecks(values.newPassword);

  const update = (key: keyof ChangePasswordValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = validateChangePassword(values);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFormError(null);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      endSession(PASSWORD_CHANGED_NOTICE);
    } catch (err) {
      if (err instanceof ApiError && err.code === AuthErrorCode.CurrentPasswordIncorrect) {
        setErrors({ currentPassword: CHANGE_PASSWORD_MESSAGES.currentIncorrect });
      } else if (err instanceof ApiError && err.code === AuthErrorCode.SamePassword) {
        setErrors({ newPassword: CHANGE_PASSWORD_MESSAGES.sameAsCurrent });
      } else {
        setFormError(errorMessage(err, 'Could not change your password.'));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Change password
        </CardTitle>
        <CardDescription>
          Changing your password signs you out everywhere — this dashboard and the ACC mobile app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="grid max-w-md gap-4" noValidate>
          <FormField
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(value) => update('currentPassword', value)}
            error={errors.currentPassword}
          />
          <div className="space-y-2">
            <FormField
              id="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={values.newPassword}
              onChange={(value) => update('newPassword', value)}
              error={errors.newPassword}
            />
            <ul className="grid gap-1 text-xs" aria-label="Password requirements">
              {PASSWORD_POLICY_RULES.map((rule) => (
                <li
                  key={rule.id}
                  className={cn(
                    'flex items-center gap-1.5',
                    checks[rule.id] ? 'text-secondary' : 'text-muted-foreground',
                  )}
                >
                  <Check
                    className={cn('size-3.5', checks[rule.id] ? 'opacity-100' : 'opacity-30')}
                  />
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
          <FormField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(value) => update('confirmPassword', value)}
            error={errors.confirmPassword}
          />
          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {formError}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="animate-spin" /> : null}
              Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
