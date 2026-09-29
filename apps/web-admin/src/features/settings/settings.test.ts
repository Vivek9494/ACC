import {
  APP_SETTINGS_VALIDATION_MESSAGES,
  CHANGE_PASSWORD_MESSAGES,
  PASSWORD_POLICY_INVALID_MESSAGE,
  maskAwsSecretAccessKey,
  type AdminAppSettings,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from '@/app/nav';

import {
  isAwsKeyChanged,
  isSystemSettingsDirty,
  systemSettingsValues,
  toUpdateSettingsRequest,
  validateChangePassword,
  validateSystemSettings,
} from './settings';

const SETTINGS: AdminAppSettings = {
  videoUploadMaxMb: 100,
  imageUploadMaxMb: 10,
  googleMapsApiKey: 'AIzaSyTestKey',
  awsKeyConfigured: true,
  awsKeyMasked: maskAwsSecretAccessKey('supersecretABCD'),
};

describe('validateChangePassword', () => {
  const valid = {
    currentPassword: 'OldPass!1',
    newPassword: 'NewPass!2',
    confirmPassword: 'NewPass!2',
  };

  it('accepts a compliant, different, confirmed password', () => {
    expect(validateChangePassword(valid)).toEqual({});
  });

  it('requires every field', () => {
    const errors = validateChangePassword({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(errors.currentPassword).toBe(CHANGE_PASSWORD_MESSAGES.currentRequired);
    expect(errors.newPassword).toBeDefined();
  });

  it('enforces the shared password policy', () => {
    const errors = validateChangePassword({
      ...valid,
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(errors.newPassword).toBe(PASSWORD_POLICY_INVALID_MESSAGE);
  });

  it('rejects reusing the current password', () => {
    const errors = validateChangePassword({
      ...valid,
      newPassword: 'OldPass!1',
      confirmPassword: 'OldPass!1',
    });
    expect(errors.newPassword).toBe(CHANGE_PASSWORD_MESSAGES.sameAsCurrent);
  });

  it('flags a confirmation mismatch', () => {
    expect(validateChangePassword({ ...valid, confirmPassword: 'NewPass!3' }).confirmPassword).toBe(
      CHANGE_PASSWORD_MESSAGES.confirmMismatch,
    );
  });
});

describe('system settings form', () => {
  const saved = systemSettingsValues(SETTINGS);

  it('starts from the masked AWS key, which counts as unchanged', () => {
    expect(saved.awsKey).toBe(SETTINGS.awsKeyMasked);
    expect(isAwsKeyChanged(saved.awsKey)).toBe(false);
    expect(isSystemSettingsDirty(saved, saved)).toBe(false);
  });

  it('validates upload limit ranges and whole numbers', () => {
    const messages = APP_SETTINGS_VALIDATION_MESSAGES;
    expect(validateSystemSettings({ ...saved, videoUploadMaxMb: '' }).videoUploadMaxMb).toBe(
      messages.videoUploadMaxMb.required,
    );
    expect(validateSystemSettings({ ...saved, videoUploadMaxMb: '501' }).videoUploadMaxMb).toBe(
      messages.videoUploadMaxMb.invalid,
    );
    expect(validateSystemSettings({ ...saved, imageUploadMaxMb: '2.5' }).imageUploadMaxMb).toBe(
      messages.imageUploadMaxMb.invalid,
    );
    expect(validateSystemSettings({ ...saved, imageUploadMaxMb: '51' }).imageUploadMaxMb).toBe(
      messages.imageUploadMaxMb.invalid,
    );
    expect(validateSystemSettings(saved)).toEqual({});
  });

  it('requires a Maps key and validates only a replaced AWS key', () => {
    expect(validateSystemSettings({ ...saved, googleMapsApiKey: '  ' }).googleMapsApiKey).toBe(
      APP_SETTINGS_VALIDATION_MESSAGES.googleMapsApiKey.required,
    );
    expect(validateSystemSettings({ ...saved, awsKey: 'short' }).awsKey).toBe(
      APP_SETTINGS_VALIDATION_MESSAGES.awsKey.invalid,
    );
    expect(validateSystemSettings({ ...saved, awsKey: '' }).awsKey).toBeUndefined();
  });

  it('omits awsKey from the request unless a new key was entered', () => {
    expect(toUpdateSettingsRequest({ ...saved, videoUploadMaxMb: ' 200 ' })).toEqual({
      videoUploadMaxMb: 200,
      imageUploadMaxMb: 10,
      googleMapsApiKey: 'AIzaSyTestKey',
    });
    expect(toUpdateSettingsRequest({ ...saved, awsKey: '' })).not.toHaveProperty('awsKey');
    expect(toUpdateSettingsRequest({ ...saved, awsKey: ' newSecretKey123 ' }).awsKey).toBe(
      'newSecretKey123',
    );
  });

  it('detects edits ignoring surrounding whitespace', () => {
    expect(isSystemSettingsDirty({ ...saved, imageUploadMaxMb: ' 10 ' }, saved)).toBe(false);
    expect(isSystemSettingsDirty({ ...saved, imageUploadMaxMb: '12' }, saved)).toBe(true);
    expect(isSystemSettingsDirty({ ...saved, awsKey: 'newSecretKey123' }, saved)).toBe(true);
  });
});

describe('nav', () => {
  it('exposes Broadcast and Settings as live sections', () => {
    const byPath = new Map(NAV_ITEMS.map((item) => [item.path, item]));
    expect(byPath.get('/broadcast')?.available).toBe(true);
    expect(byPath.get('/settings')?.available).toBe(true);
    expect(byPath.get('/broadcast')?.roles).toBeUndefined();
  });
});
