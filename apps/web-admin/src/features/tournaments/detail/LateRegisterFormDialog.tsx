import {
  BATTING_POSITION_OPTIONS,
  BATTING_STYLE_LABELS,
  BattingStyle,
  BOWLING_TYPE_OPTIONS,
  type CenterPlayerRosterEntry,
  FIELDING_POSITION_OPTIONS,
  PLAYER_REGISTRATION_ROLE_LABELS,
  PlayerRegistrationRole,
  REGISTRATION_RATING_OPTIONS,
  type RegistrationFieldDefinition,
  RegistrationFieldType,
} from '@acc/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/UserAvatar';
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
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { ChoiceSelect, type ChoiceOption, FieldShell } from '../manage/form-fields';
import {
  EMPTY_LATE_REGISTER_FORM,
  type LateRegisterErrors,
  type LateRegisterFieldKey,
  type LateRegisterFormValues,
  toLateRegistrationRequest,
  validateLateRegisterForm,
} from './late-register';
import { useRegistrationActions, useRegistrationFormFields } from './tournament-detail-api';

const RATING_CHOICES: readonly ChoiceOption[] = REGISTRATION_RATING_OPTIONS.map((o) => ({
  value: String(o.value),
  label: o.label,
}));
const toChoices = (values: readonly string[]): ChoiceOption[] =>
  values.map((value) => ({ value, label: value }));
const HAND_CHOICES: readonly ChoiceOption[] = Object.values(BattingStyle).map((value) => ({
  value,
  label: BATTING_STYLE_LABELS[value],
}));

const SKILL_ROWS: readonly {
  rating: LateRegisterFieldKey;
  ratingLabel: string;
  detail: LateRegisterFieldKey;
  detailLabel: string;
  detailChoices: readonly ChoiceOption[];
}[] = [
  {
    rating: 'battingRating',
    ratingLabel: 'Batting Rating',
    detail: 'battingPosition',
    detailLabel: 'Batting Position',
    detailChoices: toChoices(BATTING_POSITION_OPTIONS),
  },
  {
    rating: 'bowlingRating',
    ratingLabel: 'Bowling Rating',
    detail: 'bowlingType',
    detailLabel: 'Bowling Type',
    detailChoices: toChoices(BOWLING_TYPE_OPTIONS),
  },
  {
    rating: 'fieldingRating',
    ratingLabel: 'Fielding Rating',
    detail: 'fieldingPosition',
    detailLabel: 'Fielding Position',
    detailChoices: toChoices(FIELDING_POSITION_OPTIONS),
  },
];

/** Step 2 of "Register User": the mobile Register Player form, every field mandatory. */
export function LateRegisterFormDialog({
  tournamentId,
  player,
  onBack,
  onRegistered,
}: {
  tournamentId: string;
  player: CenterPlayerRosterEntry | null;
  onBack: () => void;
  onRegistered: () => void;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={player !== null} onOpenChange={(next) => !next && !busy && onBack()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        {player ? (
          <FormBody
            key={player.userId}
            tournamentId={tournamentId}
            player={player}
            onBack={onBack}
            onRegistered={onRegistered}
            onBusyChange={setBusy}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  tournamentId,
  player,
  onBack,
  onRegistered,
  onBusyChange,
}: {
  tournamentId: string;
  player: CenterPlayerRosterEntry;
  onBack: () => void;
  onRegistered: () => void;
  onBusyChange: (busy: boolean) => void;
}): React.ReactElement {
  const formFields = useRegistrationFormFields(tournamentId, true);
  const { lateRegister } = useRegistrationActions(tournamentId);
  const [values, setValues] = useState<LateRegisterFormValues>(EMPTY_LATE_REGISTER_FORM);
  const [errors, setErrors] = useState<LateRegisterErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fields = formFields.data ?? [];
  const name = `${player.firstName} ${player.lastName}`;
  const pending = lateRegister.isPending;

  const set = <K extends keyof LateRegisterFormValues>(
    key: K,
    value: LateRegisterFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const setCustom = (key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, custom: { ...current.custom, [key]: value } }));
    setErrors((current) => ({ ...current, [`custom:${key}`]: undefined }));
  };

  const submit = async () => {
    const nextErrors = validateLateRegisterForm(values, fields);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;
    onBusyChange(true);
    try {
      await lateRegister.mutateAsync(toLateRegistrationRequest(player, values, fields));
      toast.success(`${name} registered and confirmed`);
      onRegistered();
    } catch (err) {
      setSubmitError(errorMessage(err, 'Could not register this player.'));
    } finally {
      onBusyChange(false);
    }
  };

  const select = (key: LateRegisterFieldKey, label: string, choices: readonly ChoiceOption[]) => {
    const id = `late-${key}`;
    return (
      <FieldShell id={id} label={label} error={errors[key]}>
        <ChoiceSelect
          id={id}
          value={values[key] || null}
          onChange={(value) => set(key, value)}
          options={choices}
          placeholder="Select"
          disabled={pending}
          invalid={Boolean(errors[key])}
        />
      </FieldShell>
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Register player</DialogTitle>
        <DialogDescription>
          They&apos;re confirmed immediately with the ratings you enter — no separate approval step.
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-1 min-h-0 flex-1 space-y-6 overflow-y-auto px-1 @container">
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
          <UserAvatar person={player} className="size-12" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{player.centerName || '—'}</p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-secondary">Game Preferences</h3>
          {select('battingStyle', 'Batting/Bowling Hand', HAND_CHOICES)}
          <FieldShell id="late-playerRole" label="Are you?" error={errors.playerRole}>
            <div
              id="late-playerRole"
              role="radiogroup"
              aria-invalid={Boolean(errors.playerRole)}
              className="flex flex-wrap gap-2"
            >
              {Object.values(PlayerRegistrationRole).map((role) => (
                <label
                  key={role}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
                    values.playerRole === role && 'border-primary bg-primary/10',
                    errors.playerRole && 'border-destructive',
                  )}
                >
                  <input
                    type="radio"
                    name="late-playerRole"
                    value={role}
                    checked={values.playerRole === role}
                    onChange={() => set('playerRole', role)}
                    disabled={pending}
                    className="accent-primary"
                  />
                  {PLAYER_REGISTRATION_ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </FieldShell>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-secondary">Skill Assessment</h3>
          {SKILL_ROWS.map((row) => (
            <div key={row.rating} className="grid gap-4 @md:grid-cols-2">
              {select(row.rating, row.ratingLabel, RATING_CHOICES)}
              {select(row.detail, row.detailLabel, row.detailChoices)}
            </div>
          ))}
        </section>

        {fields.length > 0 ? (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-secondary">Additional Information</h3>
            {fields.map((field) => (
              <CustomField
                key={field.id}
                field={field}
                value={values.custom[field.key]}
                error={errors[`custom:${field.key}`]}
                disabled={pending}
                onChange={(value) => setCustom(field.key, value)}
              />
            ))}
          </section>
        ) : null}

        {formFields.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(
              formFields.error,
              "Couldn't load this tournament's registration questions.",
            )}
          </p>
        ) : null}
        {submitError ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {submitError}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={pending}>
          <ArrowLeft />
          Back
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={pending || formFields.isPending || formFields.isError}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Register &amp; confirm player
        </Button>
      </DialogFooter>
    </>
  );
}

function CustomField({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: RegistrationFieldDefinition;
  value: string | boolean | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}): React.ReactElement {
  const id = `late-custom-${field.key}`;
  const label = field.required ? field.label : `${field.label} (optional)`;
  if (field.fieldType === RegistrationFieldType.Boolean) {
    return (
      <FieldShell id={id} label={label} error={error}>
        <ChoiceSelect
          id={id}
          value={value === true ? 'yes' : value === false ? 'no' : null}
          onChange={(next) => onChange(next === 'yes')}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          placeholder="Select"
          disabled={disabled}
          invalid={Boolean(error)}
        />
      </FieldShell>
    );
  }
  if (field.fieldType === RegistrationFieldType.Select) {
    return (
      <FieldShell id={id} label={label} error={error}>
        <ChoiceSelect
          id={id}
          value={typeof value === 'string' && value !== '' ? value : null}
          onChange={onChange}
          options={toChoices(field.options ?? [])}
          placeholder="Select"
          disabled={disabled}
          invalid={Boolean(error)}
        />
      </FieldShell>
    );
  }
  return (
    <FieldShell id={id} label={label} error={error}>
      <Input
        id={id}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        inputMode={field.fieldType === RegistrationFieldType.Number ? 'numeric' : undefined}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
    </FieldShell>
  );
}
