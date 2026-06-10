import { Ionicons } from '@expo/vector-icons';
import {
  CANADIAN_POSTAL_CODE_DISPLAY_MAX_LENGTH,
  SIGNUP_MOBILE_LENGTH,
  SIGNUP_NAME_MAX_LENGTH,
  formatCanadianPostalCodeInput,
  normalizeCanadianPostalCode,
  formatSignupAddressInput,
  formatSignupMobileInput,
  formatSignupNameInput,
  type SignupFieldKey,
  type SignupRequest,
} from '@acc/types';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/ui/Button';
import { DateField } from '../src/components/ui/DateField';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { PasswordRequirements } from '../src/components/ui/PasswordRequirements';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { ProfilePhotoField } from '../src/components/ui/ProfilePhotoField';
import { SectionCard } from '../src/components/ui/SectionCard';
import { Select } from '../src/components/ui/Select';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import {
  firstSignupFieldError,
  mapApiErrorsToSignupFields,
  validateSignupForm,
  type SignupFieldErrors,
} from '../src/lib/signup-form-validation';
import { useSignupGeography } from '../src/lib/signup-geography';

export default function SignupScreen(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<SignupFieldKey, number>>>({});

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [province, setProvince] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { provinces, centers, provinceField, centerField } = useSignupGeography(province);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );
  const centerSelectOptions = useMemo(
    () => centers.map((c) => ({ value: c.id, label: c.name })),
    [centers],
  );

  const clearFieldError = useCallback((key: SignupFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const registerFieldLayout = useCallback((key: SignupFieldKey, event: LayoutChangeEvent) => {
    fieldOffsets.current[key] = event.nativeEvent.layout.y;
  }, []);

  const scrollToField = useCallback((key: SignupFieldKey) => {
    const y = fieldOffsets.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  }, []);

  function onProvinceChange(next: string): void {
    setProvince(next);
    setCenterId(null);
    clearFieldError('province');
    clearFieldError('center');
  }

  function onPostalCodeChange(text: string): void {
    setPostalCode(formatCanadianPostalCodeInput(text));
    clearFieldError('postalCode');
  }

  async function onSubmit(): Promise<void> {
    const errors = validateSignupForm({
      profilePhotoError,
      firstName,
      lastName,
      mobileNumber,
      email,
      dateOfBirth,
      postalCode,
      province,
      centerId,
      password,
      confirmPassword,
      emergencyContactName,
      emergencyContactNumber,
    });

    setFieldErrors(errors);
    const firstError = firstSignupFieldError(errors);
    if (firstError) {
      setFormError(null);
      scrollToField(firstError);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const trimmedPostalCode = postalCode.trim();
    const trimmedEmail = email.trim();
    try {
      const payload: SignupRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobileNumber: mobileNumber.replace(/\D/g, ''),
        dateOfBirth,
        centerId: centerId as string,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactNumber: emergencyContactNumber.replace(/\D/g, ''),
        password,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(trimmedPostalCode
          ? { postalCode: normalizeCanadianPostalCode(trimmedPostalCode) }
          : {}),
      };
      await register(payload);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const mapped = mapApiErrorsToSignupFields(err);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          const apiFirst = firstSignupFieldError(mapped);
          if (apiFirst) {
            scrollToField(apiFirst);
          }
          return;
        }
      }
      setFormError(
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const provinceSelectError =
    fieldErrors.province ??
    (provinceField.errorType === 'network' || provinceField.errorType === 'empty'
      ? provinceField.errorMessage
      : null);

  const centerSelectError =
    fieldErrors.center ??
    (province && (centerField.errorType === 'network' || centerField.errorType === 'empty')
      ? centerField.errorMessage
      : null);

  function fieldWrap(
    key: SignupFieldKey,
    children: React.ReactNode,
    className?: string,
  ): React.ReactElement {
    return (
      <View className={className} onLayout={(event) => registerFieldLayout(key, event)}>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-[#1A1A1A]">Welcome</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerClassName="px-4 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 gap-2">
          <Text className="font-sans-bold text-3xl text-primary">Join the Club</Text>
          <Text className="font-sans text-base leading-6 text-[#5A4136]">
            Complete your profile to start your journey with Hariprabodham Sports Club.
          </Text>
        </View>

        <View className="gap-5">
          {fieldWrap(
            'profilePhoto',
            <ProfilePhotoField
              label="Profile Photo"
              uri={profilePhotoUri}
              onChange={setProfilePhotoUri}
              onValidationError={setProfilePhotoError}
              error={fieldErrors.profilePhoto ?? profilePhotoError ?? undefined}
            />,
          )}

          <View className="w-full flex-row items-start gap-3">
            {fieldWrap(
              'firstName',
              <TextInput
                label="First Name"
                containerClassName="w-full"
                className="w-full"
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(formatSignupNameInput(text));
                  clearFieldError('firstName');
                }}
                placeholder="e.g. Rahul"
                autoCapitalize="words"
                maxLength={SIGNUP_NAME_MAX_LENGTH}
                error={fieldErrors.firstName}
              />,
              'min-w-0 flex-1',
            )}
            {fieldWrap(
              'lastName',
              <TextInput
                label="Last Name"
                containerClassName="w-full"
                className="w-full"
                value={lastName}
                onChangeText={(text) => {
                  setLastName(formatSignupNameInput(text));
                  clearFieldError('lastName');
                }}
                placeholder="e.g. Sharma"
                autoCapitalize="words"
                maxLength={SIGNUP_NAME_MAX_LENGTH}
                error={fieldErrors.lastName}
              />,
              'min-w-0 flex-1',
            )}
          </View>

          {fieldWrap(
            'mobileNumber',
            <TextInput
              label="Mobile Number"
              value={mobileNumber}
              onChangeText={(text) => {
                setMobileNumber(formatSignupMobileInput(text));
                clearFieldError('mobileNumber');
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="0000000000"
              maxLength={SIGNUP_MOBILE_LENGTH}
              leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
              error={fieldErrors.mobileNumber}
            />,
          )}

          {fieldWrap(
            'email',
            <TextInput
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="rahul@example.com"
              leadingIcon={<Ionicons name="mail-outline" size={20} color={FIELD_ORANGE} />}
              error={fieldErrors.email}
            />,
          )}

          {fieldWrap(
            'dateOfBirth',
            <DateField
              label="Date of Birth"
              value={dateOfBirth}
              onChange={(value) => {
                setDateOfBirth(value);
                clearFieldError('dateOfBirth');
              }}
              error={fieldErrors.dateOfBirth}
            />,
          )}

          {fieldWrap(
            'address',
            <TextInput
              label="Address"
              value={address}
              onChangeText={(text) => setAddress(formatSignupAddressInput(text))}
              placeholder="Street address"
            />,
          )}

          {fieldWrap(
            'postalCode',
            <TextInput
              label="Postal Code"
              value={postalCode}
              onChangeText={onPostalCodeChange}
              placeholder="A1A 1A1"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CANADIAN_POSTAL_CODE_DISPLAY_MAX_LENGTH}
              error={fieldErrors.postalCode}
            />,
          )}

          {fieldWrap(
            'province',
            <Select
              label="Province"
              placeholder="Select Province"
              value={province}
              options={provinceOptions}
              onChange={onProvinceChange}
              loading={provinceField.loading}
              error={provinceSelectError}
              onRetry={provinceField.errorType === 'network' ? provinceField.retry : undefined}
              emptyMessage={
                provinceField.errorType === 'network'
                  ? provinceField.errorMessage ?? 'No options available.'
                  : 'No provinces available.'
              }
              disabled={provinceField.errorType === 'empty'}
            />,
          )}

          {fieldWrap(
            'center',
            <Select
              label="Center"
              placeholder={province ? 'Select Center' : 'Select province first'}
              value={centerId}
              options={centerSelectOptions}
              onChange={(value) => {
                setCenterId(value);
                clearFieldError('center');
              }}
              loading={Boolean(province) && centerField.loading}
              error={centerSelectError}
              onRetry={
                province && centerField.errorType === 'network' ? centerField.retry : undefined
              }
              emptyMessage={
                centerField.errorType === 'network'
                  ? centerField.errorMessage ?? 'No options available.'
                  : 'No centers available in this province.'
              }
              disabled={!province || centerField.errorType === 'empty'}
            />,
          )}

          {fieldWrap(
            'password',
            <TextInput
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearFieldError('password');
              }}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              leadingIcon={<Ionicons name="lock-closed-outline" size={20} color={FIELD_ORANGE} />}
              rightAccessory={
                <PasswordToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
              error={fieldErrors.password}
            />,
          )}

          <PasswordRequirements password={password} />

          {fieldWrap(
            'confirmPassword',
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearFieldError('confirmPassword');
              }}
              secureTextEntry={!showConfirmPassword}
              placeholder="••••••••"
              leadingIcon={<Ionicons name="lock-closed-outline" size={20} color={FIELD_ORANGE} />}
              rightAccessory={
                <PasswordToggle
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((v) => !v)}
                />
              }
              error={fieldErrors.confirmPassword}
            />,
          )}

          <View onLayout={(event) => registerFieldLayout('emergencyContactName', event)}>
            <SectionCard
              icon={<Ionicons name="alert-circle" size={20} color={FIELD_ORANGE} />}
              heading="Emergency Contact"
            >
              <TextInput
                label="Contact Name"
                value={emergencyContactName}
                onChangeText={(text) => {
                  setEmergencyContactName(formatSignupNameInput(text));
                  clearFieldError('emergencyContactName');
                }}
                placeholder="Relation / Name"
                maxLength={SIGNUP_NAME_MAX_LENGTH}
                error={fieldErrors.emergencyContactName}
              />
              <View onLayout={(event) => registerFieldLayout('emergencyContactNumber', event)}>
                <TextInput
                  label="Contact Number"
                  value={emergencyContactNumber}
                  onChangeText={(text) => {
                    setEmergencyContactNumber(formatSignupMobileInput(text));
                    clearFieldError('emergencyContactNumber');
                  }}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  placeholder="0000000000"
                  maxLength={SIGNUP_MOBILE_LENGTH}
                  leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
                  error={fieldErrors.emergencyContactNumber}
                />
              </View>
            </SectionCard>
          </View>

          {formError ? (
            <View className="rounded-xl bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{formError}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onSubmit()}
            disabled={submitting}
            className="mt-2 h-14"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-sans-semibold text-base text-on-primary">Create Account</Text>
            )}
          </Button>

          <View className="flex-row justify-center gap-1 pb-4 pt-2">
            <Text className="font-sans text-sm text-on-surface-variant">
              Already have an account?
            </Text>
            <Link href="/login" className="font-sans-semibold text-sm text-primary">
              Log in
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
