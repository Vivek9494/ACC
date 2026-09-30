import {
  type BattingStyle,
  type CenterPlayerRosterEntry,
  type LateRegistrationRequest,
  type PlayerRegistrationRole,
  type RegistrationFieldDefinition,
} from '@acc/types';

export type LateRegisterFieldKey =
  | 'battingStyle'
  | 'playerRole'
  | 'battingRating'
  | 'battingPosition'
  | 'bowlingRating'
  | 'bowlingType'
  | 'fieldingRating'
  | 'fieldingPosition';

/** Select values are strings ('' = not chosen yet); custom answers mirror mobile (string | boolean). */
export interface LateRegisterFormValues {
  battingStyle: BattingStyle | '';
  playerRole: PlayerRegistrationRole | '';
  battingRating: string;
  battingPosition: string;
  bowlingRating: string;
  bowlingType: string;
  fieldingRating: string;
  fieldingPosition: string;
  custom: Record<string, string | boolean>;
}

export const EMPTY_LATE_REGISTER_FORM: LateRegisterFormValues = {
  battingStyle: '',
  playerRole: '',
  battingRating: '',
  battingPosition: '',
  bowlingRating: '',
  bowlingType: '',
  fieldingRating: '',
  fieldingPosition: '',
  custom: {},
};

const REQUIRED_MESSAGES: Record<LateRegisterFieldKey, string> = {
  battingStyle: 'Select the batting/bowling hand.',
  playerRole: 'Select batsman, bowler or all-rounder.',
  battingRating: 'Select a batting rating.',
  battingPosition: 'Select a batting position.',
  bowlingRating: 'Select a bowling rating.',
  bowlingType: 'Select a bowling type.',
  fieldingRating: 'Select a fielding rating.',
  fieldingPosition: 'Select a fielding position.',
};

export type LateRegisterErrors = Partial<Record<LateRegisterFieldKey | `custom:${string}`, string>>;

const isAnswered = (value: string | boolean | undefined): boolean =>
  typeof value === 'boolean' || (typeof value === 'string' && value.trim() !== '');

/** Every default field is mandatory (like mobile); custom fields only when the Admin marked them required. */
export function validateLateRegisterForm(
  values: LateRegisterFormValues,
  fields: readonly RegistrationFieldDefinition[],
): LateRegisterErrors {
  const errors: LateRegisterErrors = {};
  for (const key of Object.keys(REQUIRED_MESSAGES) as LateRegisterFieldKey[]) {
    if (values[key] === '') errors[key] = REQUIRED_MESSAGES[key];
  }
  for (const field of fields) {
    if (field.required && !isAnswered(values.custom[field.key])) {
      errors[`custom:${field.key}`] = `${field.label} is required.`;
    }
  }
  return errors;
}

/** Only call once {@link validateLateRegisterForm} returns no errors. */
export function toLateRegistrationRequest(
  player: CenterPlayerRosterEntry,
  values: LateRegisterFormValues,
  fields: readonly RegistrationFieldDefinition[],
): LateRegistrationRequest {
  const custom = Object.fromEntries(
    fields
      .filter((field) => isAnswered(values.custom[field.key]))
      .map((field) => [field.key, values.custom[field.key]]),
  );
  return {
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    centerId: player.centerId,
    battingStyle: values.battingStyle || null,
    playerRole: values.playerRole || null,
    battingRating: Number(values.battingRating),
    battingPosition: values.battingPosition,
    bowlingRating: Number(values.bowlingRating),
    bowlingType: values.bowlingType,
    fieldingRating: Number(values.fieldingRating),
    fieldingPosition: values.fieldingPosition,
    playerType: null,
    customFields: fields.length > 0 ? custom : null,
  };
}
