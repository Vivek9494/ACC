import {
  ADMIN_ASSIGNABLE_ROLES,
  ADMIN_USER_ROLE_LABELS,
  PLAYER_REGISTRATION_ROLE_LABELS,
  PlayerRegistrationRole,
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  REGISTRATION_RATING_OPTIONS,
  SIGNUP_NAME_MAX_LENGTH,
  UserRole,
  formatSignupMobileInput,
  formatSignupNameInput,
  isAdminPlayingRole,
  type CreateAdminUserRequest,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { DateField } from '../../../src/components/ui/DateField';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Select, type SelectOption } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { setRevealedTempPassword } from '../../../src/lib/admin-temp-password-session';
import {
  ADMIN_USER_CREATE_FIELD_ORDER,
  firstAdminUserFieldError,
  mapApiErrorsToAdminUserFields,
  validateAdminUserCreateForm,
  type AdminUserFieldErrors,
  type AdminUserFieldKey,
} from '../../../src/lib/admin-user-form-validation';
import { ApiRequestError, createAdminUser } from '../../../src/lib/api';
import { loginMobileForApi } from '../../../src/lib/login-messages';
import { useSignupGeography } from '../../../src/lib/signup-geography';

function ratingOptions(): SelectOption[] {
  return REGISTRATION_RATING_OPTIONS.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));
}

const ROLE_OPTIONS: SelectOption[] = ADMIN_ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: ADMIN_USER_ROLE_LABELS[role],
}));

const PLAYER_ROLE_OPTIONS: SelectOption[] = (
  Object.keys(PLAYER_REGISTRATION_ROLE_LABELS) as PlayerRegistrationRole[]
).map((role) => ({
  value: role,
  label: PLAYER_REGISTRATION_ROLE_LABELS[role],
}));

const PLAYER_TYPE_OPTIONS: SelectOption[] = REGISTRATION_PLAYER_TYPE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <View className="gap-4">
      <Text className="mt-6 font-sans-semibold text-xs uppercase tracking-wider text-primary">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function AdminUserCreateScreen(): React.ReactElement {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<AdminUserFieldKey, number>>>({});

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AdminUserFieldErrors>({});

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [platformRole, setPlatformRole] = useState<string>(UserRole.Player);
  const [playerRole, setPlayerRole] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<string | null>(null);
  const [battingRating, setBattingRating] = useState<string | null>(null);
  const [bowlingRating, setBowlingRating] = useState<string | null>(null);
  const [fieldingRating, setFieldingRating] = useState<string | null>(null);

  const { provinceField, centerField } = useSignupGeography(provinceId);
  const showPlayingFields = isAdminPlayingRole(platformRole as UserRole);

  const provinceOptions = useMemo(
    () => provinceField.items.map((row) => ({ value: row.id, label: row.name })),
    [provinceField.items],
  );
  const centerOptions = useMemo(
    () => centerField.items.map((row) => ({ value: row.id, label: row.name })),
    [centerField.items],
  );

  const clearFieldError = useCallback((key: AdminUserFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const registerFieldLayout = useCallback((key: AdminUserFieldKey, event: LayoutChangeEvent) => {
    fieldOffsets.current[key] = event.nativeEvent.layout.y;
  }, []);

  const scrollToField = useCallback((key: AdminUserFieldKey) => {
    const y = fieldOffsets.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  }, []);

  function fieldWrap(
    key: AdminUserFieldKey,
    children: React.ReactNode,
    className?: string,
  ): React.ReactElement {
    return (
      <View className={className} onLayout={(event) => registerFieldLayout(key, event)}>
        {children}
      </View>
    );
  }

  function onProvinceChange(next: string): void {
    setProvinceId(next);
    setCenterId(null);
    clearFieldError('province');
    clearFieldError('center');
  }

  async function onCreate(): Promise<void> {
    const errors = validateAdminUserCreateForm({
      firstName,
      lastName,
      mobileNumber,
      email,
      dateOfBirth,
    });

    setFieldErrors(errors);
    const firstError = firstAdminUserFieldError(errors, ADMIN_USER_CREATE_FIELD_ORDER);
    if (firstError) {
      scrollToField(firstError);
      return;
    }

    setSaving(true);

    const body: CreateAdminUserRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobileNumber: loginMobileForApi(mobileNumber),
      platformRole: platformRole as CreateAdminUserRequest['platformRole'],
    };

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      body.email = trimmedEmail;
    }
    if (provinceId) {
      body.provinceId = provinceId;
    }
    if (centerId) {
      body.centerId = centerId;
    }
    if (dateOfBirth) {
      body.dateOfBirth = dateOfBirth;
    }

    if (showPlayingFields) {
      if (playerRole) {
        body.playerRole = playerRole as CreateAdminUserRequest['playerRole'];
      }
      if (playerType) {
        body.playerType = playerType as CreateAdminUserRequest['playerType'];
      }
      if (battingRating !== null) {
        body.battingRating = Number(battingRating);
      }
      if (bowlingRating !== null) {
        body.bowlingRating = Number(bowlingRating);
      }
      if (fieldingRating !== null) {
        body.fieldingRating = Number(fieldingRating);
      }
    }

    try {
      const result = await createAdminUser(body);
      setRevealedTempPassword(result.user.id, result.temporaryPassword, result.expiresAt);
      router.replace(`/admin/users/${result.user.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const mapped = mapApiErrorsToAdminUserFields(err);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          const apiFirst = firstAdminUserFieldError(mapped, ADMIN_USER_CREATE_FIELD_ORDER);
          if (apiFirst) {
            scrollToField(apiFirst);
          }
          return;
        }
        Alert.alert('Could not create user', err.message);
        return;
      }
      Alert.alert('Could not create user', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const provinceSelectError =
    fieldErrors.province ??
    (provinceField.errorType === 'network' || provinceField.errorType === 'empty'
      ? provinceField.errorMessage
      : null);

  const centerSelectError =
    fieldErrors.center ??
    (provinceId && (centerField.errorType === 'network' || centerField.errorType === 'empty')
      ? centerField.errorMessage
      : null);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Add User" onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        ref={scrollRef}
        contentContainerClassName="px-4 pt-2"
        extraBottomPadding={40}
      >
        <View className="gap-4">
          {fieldWrap(
            'firstName',
            <TextInput
              label="First name"
              value={firstName}
              onChangeText={(value) => {
                setFirstName(formatSignupNameInput(value));
                clearFieldError('firstName');
              }}
              maxLength={SIGNUP_NAME_MAX_LENGTH}
              error={fieldErrors.firstName}
            />,
          )}
          {fieldWrap(
            'lastName',
            <TextInput
              label="Last name"
              value={lastName}
              onChangeText={(value) => {
                setLastName(formatSignupNameInput(value));
                clearFieldError('lastName');
              }}
              maxLength={SIGNUP_NAME_MAX_LENGTH}
              error={fieldErrors.lastName}
            />,
          )}
          {fieldWrap(
            'mobileNumber',
            <TextInput
              label="Mobile"
              value={mobileNumber}
              onChangeText={(value) => {
                setMobileNumber(formatSignupMobileInput(value));
                clearFieldError('mobileNumber');
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="0000000000"
              error={fieldErrors.mobileNumber}
            />,
          )}
          <Select
            label="Role"
            value={platformRole}
            options={ROLE_OPTIONS}
            onChange={setPlatformRole}
          />
          {fieldWrap(
            'email',
            <TextInput
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearFieldError('email');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={fieldErrors.email}
            />,
          )}
          {fieldWrap(
            'province',
            <Select
              label="Province"
              value={provinceId ?? ''}
              options={provinceOptions}
              onChange={onProvinceChange}
              loading={provinceField.loading}
              error={provinceSelectError}
              onRetry={provinceField.retry}
            />,
          )}
          {fieldWrap(
            'center',
            <Select
              label="Center"
              value={centerId ?? ''}
              options={centerOptions}
              onChange={(value) => {
                setCenterId(value);
                clearFieldError('center');
              }}
              loading={centerField.loading}
              disabled={!provinceId}
              error={centerSelectError}
              onRetry={centerField.retry}
            />,
          )}
          {fieldWrap(
            'dateOfBirth',
            <DateField
              label="Date of birth"
              value={dateOfBirth}
              onChange={(value) => {
                setDateOfBirth(value);
                clearFieldError('dateOfBirth');
              }}
              error={fieldErrors.dateOfBirth}
            />,
          )}
        </View>

        {showPlayingFields ? (
          <FormSection title="Player profile">
            <View className="gap-4">
              <Select
                label="Player type (Leather)"
                value={playerType ?? ''}
                options={PLAYER_TYPE_OPTIONS}
                onChange={setPlayerType}
                placeholder="Not set"
              />
              <Select
                label="Primary role"
                value={playerRole ?? ''}
                options={PLAYER_ROLE_OPTIONS}
                onChange={setPlayerRole}
                placeholder="Not set"
              />
              <Text className="font-sans text-xs text-text-muted">
                Skill ratings (0–10) are recorded for audit and apply when the user registers for a
                tournament.
              </Text>
              <Select
                label="Batting"
                value={battingRating ?? ''}
                options={ratingOptions()}
                onChange={setBattingRating}
                placeholder="Not set"
              />
              <Select
                label="Bowling"
                value={bowlingRating ?? ''}
                options={ratingOptions()}
                onChange={setBowlingRating}
                placeholder="Not set"
              />
              <Select
                label="Fielding"
                value={fieldingRating ?? ''}
                options={ratingOptions()}
                onChange={setFieldingRating}
                placeholder="Not set"
              />
            </View>
          </FormSection>
        ) : null}

        <Text className="mt-6 font-sans text-sm text-on-surface-variant">
          A one-time temporary password will be generated when you create this account. The user must
          set their own password on first login.
        </Text>

        <Button
          label={saving ? 'Creating…' : 'Create user'}
          onPress={() => void onCreate()}
          disabled={saving}
          className="mt-6 h-14"
        />
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
