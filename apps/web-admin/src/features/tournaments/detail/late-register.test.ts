import {
  BattingStyle,
  type CenterPlayerRosterEntry,
  PlayerRegistrationRole,
  type RegistrationFieldDefinition,
  RegistrationFieldType,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_LATE_REGISTER_FORM,
  type LateRegisterFormValues,
  toLateRegistrationRequest,
  validateLateRegisterForm,
} from './late-register';

const player: CenterPlayerRosterEntry = {
  userId: 'u-1',
  centerId: 'c-1',
  centerName: 'Toronto',
  firstName: 'Ravi',
  lastName: 'Patel',
  mobileNumber: '+14165550001',
  profilePhotoUrl: null,
};

const field = (overrides: Partial<RegistrationFieldDefinition>): RegistrationFieldDefinition => ({
  id: 'f-1',
  key: 'jersey',
  label: 'Jersey size',
  fieldType: RegistrationFieldType.Select,
  required: true,
  options: ['S', 'M'],
  position: 0,
  ...overrides,
});

const complete: LateRegisterFormValues = {
  battingStyle: BattingStyle.LHB,
  playerRole: PlayerRegistrationRole.AllRounder,
  battingRating: '7',
  battingPosition: 'Opener',
  bowlingRating: '0',
  bowlingType: 'Leg Spin',
  fieldingRating: '5',
  fieldingPosition: 'Slips',
  custom: {},
};

describe('validateLateRegisterForm', () => {
  it('requires every default field', () => {
    expect(Object.keys(validateLateRegisterForm(EMPTY_LATE_REGISTER_FORM, []))).toEqual([
      'battingStyle',
      'playerRole',
      'battingRating',
      'battingPosition',
      'bowlingRating',
      'bowlingType',
      'fieldingRating',
      'fieldingPosition',
    ]);
  });

  it('accepts a zero rating and a "No" boolean answer, but not a blank required custom field', () => {
    const fields = [
      field({}),
      field({ id: 'f-2', key: 'car', label: 'Has car', fieldType: RegistrationFieldType.Boolean }),
      field({
        id: 'f-3',
        key: 'note',
        label: 'Note',
        fieldType: RegistrationFieldType.Text,
        required: false,
      }),
    ];
    expect(
      validateLateRegisterForm({ ...complete, custom: { car: false, jersey: ' ' } }, fields),
    ).toEqual({
      'custom:jersey': 'Jersey size is required.',
    });
    expect(
      validateLateRegisterForm({ ...complete, custom: { car: false, jersey: 'M' } }, fields),
    ).toEqual({});
  });
});

describe('toLateRegistrationRequest', () => {
  it("registers under the player's own name and center with numeric ratings", () => {
    expect(
      toLateRegistrationRequest(player, { ...complete, custom: { jersey: 'M', note: '' } }, [
        field({}),
        field({ id: 'f-3', key: 'note', fieldType: RegistrationFieldType.Text, required: false }),
      ]),
    ).toEqual({
      userId: 'u-1',
      firstName: 'Ravi',
      lastName: 'Patel',
      centerId: 'c-1',
      battingStyle: 'LHB',
      playerRole: 'ALL_ROUNDER',
      battingRating: 7,
      battingPosition: 'Opener',
      bowlingRating: 0,
      bowlingType: 'Leg Spin',
      fieldingRating: 5,
      fieldingPosition: 'Slips',
      playerType: null,
      customFields: { jersey: 'M' },
    });
  });

  it('sends null custom fields when the tournament has no custom form', () => {
    expect(toLateRegistrationRequest(player, complete, []).customFields).toBeNull();
  });
});
