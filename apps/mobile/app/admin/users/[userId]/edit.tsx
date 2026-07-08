import {
  ADMIN_ASSIGNABLE_ROLES,
  ADMIN_USER_ROLE_LABELS,
  REGISTRATION_RATING_OPTIONS,
  SIGNUP_NAME_MAX_LENGTH,
  formatSignupMobileInput,
  formatSignupNameInput,
  profileMobileDisplay,
  type AdminUserDetail,
  UserRole,
  type UpdateAdminUserRequest,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { DateField } from '../../../../src/components/ui/DateField';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Select, type SelectOption } from '../../../../src/components/ui/Select';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import {
  ADMIN_USER_EDIT_FIELD_ORDER,
  firstAdminUserFieldError,
  mapApiErrorsToAdminUserFields,
  validateAdminUserEditForm,
  type AdminUserFieldErrors,
  type AdminUserFieldKey,
} from '../../../../src/lib/admin-user-form-validation';
import { ApiRequestError, getAdminUser, updateAdminUser } from '../../../../src/lib/api';
import { loginMobileForApi } from '../../../../src/lib/login-messages';
import { useSignupGeography } from '../../../../src/lib/signup-geography';

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

export default function AdminUserEditScreen(): React.ReactElement {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<AdminUserFieldKey, number>>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AdminUserFieldErrors>({});

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [jerseyName, setJerseyName] = useState('');
  const [platformRole, setPlatformRole] = useState<string>(UserRole.Player);
  const [battingRating, setBattingRating] = useState<string | null>(null);
  const [bowlingRating, setBowlingRating] = useState<string | null>(null);
  const [fieldingRating, setFieldingRating] = useState<string | null>(null);

  const { provinceField, centerField } = useSignupGeography(provinceId);

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

  const applyUser = useCallback((user: AdminUserDetail) => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setMobileNumber(profileMobileDisplay(user.mobileNumber));
    setProvinceId(user.provinceId);
    setCenterId(user.centerId);
    setDateOfBirth(user.dateOfBirth);
    setJerseyNumber(String(user.jerseyNumber));
    setJerseyName(user.jerseyName ?? '');
    setPlatformRole(user.platformRole);
    setBattingRating(user.battingRating === null ? null : String(user.battingRating));
    setBowlingRating(user.bowlingRating === null ? null : String(user.bowlingRating));
    setFieldingRating(user.fieldingRating === null ? null : String(user.fieldingRating));
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!userId) {
      setError('User not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    getAdminUser(userId)
      .then(applyUser)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'You do not have permission to edit this user.',
        );
      })
      .finally(() => setLoading(false));
  }, [applyUser, userId]);

  function onProvinceChange(next: string): void {
    setProvinceId(next);
    setCenterId(null);
    clearFieldError('province');
    clearFieldError('center');
  }

  async function onSave(): Promise<void> {
    if (!userId) {
      return;
    }

    const errors = validateAdminUserEditForm({
      firstName,
      lastName,
      mobileNumber,
      email,
      dateOfBirth,
      provinceId,
      centerId,
      jerseyNumber,
      jerseyName,
    });

    setFieldErrors(errors);
    const firstError = firstAdminUserFieldError(errors, ADMIN_USER_EDIT_FIELD_ORDER);
    if (firstError) {
      scrollToField(firstError);
      return;
    }

    setSaving(true);
    const trimmedEmail = email.trim();
    const body: UpdateAdminUserRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobileNumber: loginMobileForApi(mobileNumber),
      email: trimmedEmail,
      provinceId: provinceId as string,
      centerId: centerId as string,
      dateOfBirth,
      jerseyNumber: Number(jerseyNumber),
      jerseyName: jerseyName.trim() || null,
      platformRole: platformRole as UpdateAdminUserRequest['platformRole'],
      battingRating: battingRating === null ? null : Number(battingRating),
      bowlingRating: bowlingRating === null ? null : Number(bowlingRating),
      fieldingRating: fieldingRating === null ? null : Number(fieldingRating),
    };
    try {
      await updateAdminUser(userId, body);
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const mapped = mapApiErrorsToAdminUserFields(err);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          const apiFirst = firstAdminUserFieldError(mapped, ADMIN_USER_EDIT_FIELD_ORDER);
          if (apiFirst) {
            scrollToField(apiFirst);
          }
          return;
        }
        Alert.alert('Could not save changes', err.message);
        return;
      }
      Alert.alert('Could not save changes', 'Something went wrong. Please try again.');
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
      <ScreenHeader title="Edit Profile" onBack={() => router.back()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-primary">{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
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
            {fieldWrap(
              'jerseyNumber',
              <TextInput
                label="Jersey number"
                value={jerseyNumber}
                onChangeText={(value) => {
                  setJerseyNumber(value);
                  clearFieldError('jerseyNumber');
                }}
                keyboardType="number-pad"
                error={fieldErrors.jerseyNumber}
              />,
            )}
            {fieldWrap(
              'jerseyName',
              <TextInput
                label="Jersey name"
                value={jerseyName}
                onChangeText={(value) => {
                  setJerseyName(formatSignupNameInput(value));
                  clearFieldError('jerseyName');
                }}
                maxLength={SIGNUP_NAME_MAX_LENGTH}
                error={fieldErrors.jerseyName}
              />,
            )}
            <Select
              label="Role"
              value={platformRole}
              options={ROLE_OPTIONS}
              onChange={setPlatformRole}
            />
          </View>

          <FormSection title="Skill ratings">
            <View className="gap-4">
              <Text className="font-sans text-xs text-text-muted">
                Applied to the user&apos;s most recent registration when one exists (0–10).
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

          <Button
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={() => void onSave()}
            disabled={saving}
            className="mt-6 h-14"
          />
        </KeyboardAwareFormScrollView>
      ) : null}
    </SafeAreaView>
  );
}
