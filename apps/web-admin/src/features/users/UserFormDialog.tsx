import {
  ADMIN_ASSIGNABLE_ROLES,
  ADMIN_USER_ROLE_LABELS,
  REGISTRATION_RATING_OPTIONS,
  SIGNUP_NAME_MAX_LENGTH,
  UserRole,
  formatSignupMobileInput,
  formatSignupNameInput,
  mapAdminUserApiErrorToFields,
  normalizeCanadianMobile,
  profileMobileDisplay,
  validateAdminUserCreateForm,
  validateAdminUserEditForm,
  type AdminUserDetail,
  type AdminUserFieldErrors,
  type AdminUserFieldKey,
  type CreateAdminUserRequest,
  type CreateAdminUserResponse,
  type UpdateAdminUserRequest,
} from '@acc/types';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { centersInProvince, useCenters, useProvinces } from '@/features/geography/use-geography';
import { ApiError, errorMessage } from '@/lib/api-client';

import { useAdminUser, useCreateAdminUser, useUpdateAdminUser } from './users-api';

export type UserFormTarget = { mode: 'create' } | { mode: 'edit'; userId: string };

const NOT_SET = 'none';

type RatingKey = 'battingRating' | 'bowlingRating' | 'fieldingRating';

const RATING_FIELDS: { key: RatingKey; label: string }[] = [
  { key: 'battingRating', label: 'Batting' },
  { key: 'bowlingRating', label: 'Bowling' },
  { key: 'fieldingRating', label: 'Fielding' },
];

interface FormValues {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  provinceId: string | null;
  centerId: string | null;
  dateOfBirth: string;
  platformRole: UserRole;
  jerseyNumber: string;
  jerseyName: string;
  battingRating: string;
  bowlingRating: string;
  fieldingRating: string;
}

function isAssignableRole(value: string): value is UserRole {
  return ADMIN_ASSIGNABLE_ROLES.some((role) => role === value);
}

function ratingToField(value: number | null): string {
  return value === null ? NOT_SET : String(value);
}

function fieldToRating(value: string): number | null {
  return value === NOT_SET ? null : Number(value);
}

function initialValues(user: AdminUserDetail | undefined): FormValues {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    mobileNumber: user ? profileMobileDisplay(user.mobileNumber) : '',
    email: user?.email ?? '',
    provinceId: user?.provinceId ?? null,
    centerId: user?.centerId ?? null,
    dateOfBirth: user?.dateOfBirth ?? '',
    // Legacy rows may carry a scoped role on User.role — fall back to Player.
    platformRole: user && isAssignableRole(user.platformRole) ? user.platformRole : UserRole.Player,
    jerseyNumber: user ? String(user.jerseyNumber) : '',
    jerseyName: user?.jerseyName ?? '',
    battingRating: ratingToField(user?.battingRating ?? null),
    bowlingRating: ratingToField(user?.bowlingRating ?? null),
    fieldingRating: ratingToField(user?.fieldingRating ?? null),
  };
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function UserForm({
  mode,
  user,
  onDone,
  onCreated,
}: {
  mode: 'create' | 'edit';
  user?: AdminUserDetail;
  onDone: () => void;
  onCreated: (result: CreateAdminUserResponse) => void;
}): React.ReactElement {
  const [values, setValues] = useState<FormValues>(() => initialValues(user));
  const [errors, setErrors] = useState<AdminUserFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const provinces = useProvinces();
  const centers = useCenters();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const saving = createUser.isPending || updateUser.isPending;

  const centerOptions = useMemo(
    () => centersInProvince(centers.data ?? [], values.provinceId),
    [centers.data, values.provinceId],
  );

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K], errorKey?: AdminUserFieldKey) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errorKey) setErrors((e) => ({ ...e, [errorKey]: undefined }));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const validation =
      mode === 'create' ? validateAdminUserCreateForm(values) : validateAdminUserEditForm(values);
    setErrors(validation);
    if (Object.values(validation).some(Boolean) || !values.provinceId || !values.centerId) return;

    const shared = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      mobileNumber: normalizeCanadianMobile(values.mobileNumber),
      platformRole: values.platformRole,
      provinceId: values.provinceId,
      centerId: values.centerId,
    };

    try {
      if (mode === 'create') {
        const body: CreateAdminUserRequest = {
          ...shared,
          ...(values.email.trim() ? { email: values.email.trim() } : {}),
          ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
        };
        const result = await createUser.mutateAsync(body);
        onCreated(result);
      } else if (user) {
        const body: UpdateAdminUserRequest = {
          ...shared,
          email: values.email.trim(),
          dateOfBirth: values.dateOfBirth,
          jerseyNumber: Number(values.jerseyNumber),
          jerseyName: values.jerseyName.trim() || null,
          battingRating: fieldToRating(values.battingRating),
          bowlingRating: fieldToRating(values.bowlingRating),
          fieldingRating: fieldToRating(values.fieldingRating),
        };
        await updateUser.mutateAsync({ userId: user.id, body });
        toast.success(`${body.firstName} ${body.lastName} updated`);
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapAdminUserApiErrorToFields({ code: err.code, message: err.messages });
        if (Object.keys(mapped).length > 0) {
          setErrors((prev) => ({ ...prev, ...mapped }));
          return;
        }
      }
      setFormError(errorMessage(err, mode === 'create' ? 'Could not create user.' : 'Could not save changes.'));
    }
  };

  const geoError = provinces.isError || centers.isError ? 'Could not load provinces and centers.' : undefined;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName}>
          <Input
            id="firstName"
            value={values.firstName}
            maxLength={SIGNUP_NAME_MAX_LENGTH}
            aria-invalid={Boolean(errors.firstName)}
            onChange={(e) => set('firstName', formatSignupNameInput(e.target.value), 'firstName')}
          />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName}>
          <Input
            id="lastName"
            value={values.lastName}
            maxLength={SIGNUP_NAME_MAX_LENGTH}
            aria-invalid={Boolean(errors.lastName)}
            onChange={(e) => set('lastName', formatSignupNameInput(e.target.value), 'lastName')}
          />
        </Field>
        <Field id="mobileNumber" label="Mobile" error={errors.mobileNumber}>
          <Input
            id="mobileNumber"
            inputMode="tel"
            placeholder="0000000000"
            value={values.mobileNumber}
            aria-invalid={Boolean(errors.mobileNumber)}
            onChange={(e) => set('mobileNumber', formatSignupMobileInput(e.target.value), 'mobileNumber')}
          />
        </Field>
        <Field id="platformRole" label="Role" hint="Captain, Vice Captain and Manager are assigned per team.">
          <Select
            value={values.platformRole}
            onValueChange={(v) => {
              if (isAssignableRole(v)) set('platformRole', v);
            }}
          >
            <SelectTrigger id="platformRole">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ADMIN_USER_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            placeholder="Optional"
            value={values.email}
            aria-invalid={Boolean(errors.email)}
            onChange={(e) => set('email', e.target.value, 'email')}
          />
        </Field>
        <Field id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth}>
          <Input
            id="dateOfBirth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={values.dateOfBirth}
            aria-invalid={Boolean(errors.dateOfBirth)}
            onChange={(e) => set('dateOfBirth', e.target.value, 'dateOfBirth')}
          />
        </Field>
        <Field id="province" label="Province" error={errors.province ?? geoError}>
          <Select
            value={values.provinceId ?? undefined}
            onValueChange={(v) => {
              setValues((prev) => ({ ...prev, provinceId: v, centerId: null }));
              setErrors((e) => ({ ...e, province: undefined, center: undefined }));
            }}
            disabled={provinces.isPending}
          >
            <SelectTrigger id="province" aria-invalid={Boolean(errors.province)} className="aria-invalid:border-destructive">
              <SelectValue placeholder={provinces.isPending ? 'Loading…' : 'Select province'} />
            </SelectTrigger>
            <SelectContent>
              {(provinces.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="center" label="Center" error={errors.center}>
          <Select
            // Keyed so clearing the center on province change resets the trigger text.
            key={values.provinceId ?? 'none'}
            value={values.centerId ?? undefined}
            onValueChange={(v) => set('centerId', v, 'center')}
            disabled={!values.provinceId || centers.isPending}
          >
            <SelectTrigger id="center" aria-invalid={Boolean(errors.center)} className="aria-invalid:border-destructive">
              <SelectValue placeholder={values.provinceId ? 'Select center' : 'Select a province first'} />
            </SelectTrigger>
            <SelectContent>
              {centerOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {mode === 'edit' ? (
          <>
            <Field id="jerseyNumber" label="Jersey number" error={errors.jerseyNumber}>
              <Input
                id="jerseyNumber"
                inputMode="numeric"
                value={values.jerseyNumber}
                aria-invalid={Boolean(errors.jerseyNumber)}
                onChange={(e) => set('jerseyNumber', e.target.value.replace(/\D/g, '').slice(0, 3), 'jerseyNumber')}
              />
            </Field>
            <Field id="jerseyName" label="Jersey name" error={errors.jerseyName}>
              <Input
                id="jerseyName"
                placeholder="Optional"
                maxLength={SIGNUP_NAME_MAX_LENGTH}
                value={values.jerseyName}
                aria-invalid={Boolean(errors.jerseyName)}
                onChange={(e) => set('jerseyName', formatSignupNameInput(e.target.value), 'jerseyName')}
              />
            </Field>
          </>
        ) : null}
      </div>

      {mode === 'edit' ? (
        <fieldset className="grid gap-3 rounded-lg border bg-muted/40 p-4">
          <legend className="px-1 text-xs font-semibold tracking-wider text-primary uppercase">Skill ratings</legend>
          <p className="-mt-1 text-xs text-muted-foreground">
            Applied to the user&apos;s most recent registration when one exists (0–10).
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {RATING_FIELDS.map(({ key, label }) => (
              <Field key={key} id={key} label={label}>
                <Select value={values[key]} onValueChange={(v) => set(key, v)}>
                  <SelectTrigger id={key}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>Not set</SelectItem>
                    {REGISTRATION_RATING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          A one-time temporary password is generated when you create this account. The user must set their own
          password on first login.
        </p>
      )}

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {formError}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {mode === 'create' ? 'Create user' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserFormDialog({
  target,
  onClose,
  onCreated,
}: {
  target: UserFormTarget | null;
  onClose: () => void;
  onCreated: (result: CreateAdminUserResponse) => void;
}): React.ReactElement {
  const editId = target?.mode === 'edit' ? target.userId : null;
  const detail = useAdminUser(editId);
  const isCreate = target?.mode === 'create';

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add user' : 'Edit user'}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Create an account. Share the temporary password with the user.'
              : 'Update profile details and platform role.'}
          </DialogDescription>
        </DialogHeader>

        {isCreate ? (
          <UserForm mode="create" onDone={onClose} onCreated={onCreated} />
        ) : detail.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading user…
          </div>
        ) : detail.isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-7 text-destructive" />
            <p className="text-sm">{errorMessage(detail.error, 'Could not load this user.')}</p>
            <Button variant="outline" onClick={() => void detail.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <UserForm key={detail.data.id} mode="edit" user={detail.data} onDone={onClose} onCreated={onCreated} />
        )}
      </DialogContent>
    </Dialog>
  );
}
