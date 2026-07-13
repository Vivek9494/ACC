import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  CANADIAN_POSTAL_CODE_DISPLAY_MAX_LENGTH,
  JERSEY_SIZE_OPTIONS,
  SIGNUP_NAME_MAX_LENGTH,
  formatCanadianPostalCodeDisplay,
  formatCanadianPostalCodeInput,
  formatSignupAddressInput,
  formatSignupMobileInput,
  formatSignupNameInput,
  isMediaStorageKey,
  normalizeCanadianPostalCode,
  profileMobileDisplay,
} from '@acc/types';
import type { SelectOption } from '../src/components/ui/Select';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../src/components/ui/KeyboardAwareFormScrollView';
import { Checkbox } from '../src/components/ui/Checkbox';
import { DateField } from '../src/components/ui/DateField';
import { EditProfilePhoto } from '../src/components/ui/EditProfilePhoto';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Select } from '../src/components/ui/Select';
import { SuccessDialog } from '../src/components/ui/SuccessDialog';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, getProfile, updateProfile } from '../src/lib/api';
import { uploadProfilePhoto } from '../src/lib/imageUpload';
import { useAuth } from '../src/lib/auth-context';
import {
  isJerseySizeValue,
  validateProfileForm,
  type ProfileFieldErrors,
} from '../src/lib/profile-form-validation';
import {
  ensureUploadableUri,
  isLocalImageUri,
  pickedToStored,
  resolveImageFileSize,
  storedImageFromPresignedReadUrl,
  type PickedImageFile,
  type StoredImageFile,
} from '../src/lib/imagePicker';
import { resolveMediaDisplayUrl } from '../src/lib/media-url';
import { useSignupGeography } from '../src/lib/signup-geography';

/** Fallback when @acc/types export is unavailable before a rebuild. */
const FALLBACK_JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export default function EditProfileScreen(): React.ReactElement {
  const router = useRouter();
  const { status, applyProfileUpdate } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<StoredImageFile | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [hasHealthCard, setHasHealthCard] = useState(false);
  const [jerseySize, setJerseySize] = useState<string | null>(null);
  const [jerseyName, setJerseyName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');

  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { provinces, centers, provinceField, centerField } = useSignupGeography(provinceId);

  const jerseySizeOptions = useMemo((): SelectOption[] => {
    const sizes = JERSEY_SIZE_OPTIONS ?? FALLBACK_JERSEY_SIZES;
    return (sizes ?? []).map((size) => ({ value: size, label: size }));
  }, []);

  const provinceOptions = useMemo(
    () => (provinces ?? []).map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  const centerOptions = useMemo(
    () => (centers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [centers],
  );

  const geographyReady =
    !provinceField.loading && (!provinceId || !centerField.loading);

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

  function onProvinceChange(next: string): void {
    setProvinceId(next);
    setCenterId(null);
    clearFieldError('province');
    clearFieldError('center');
  }

  useEffect(() => {
    if (!centerId || centers.length === 0) {
      return;
    }
    if (!centers.some((center) => center.id === centerId)) {
      setCenterId(null);
    }
  }, [centerId, centers]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setProfileReady(false);
    setLoadError(null);
    try {
      const profile = await getProfile();
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      const displayMobile = profileMobileDisplay(profile.mobileNumber);
      setMobileNumber(displayMobile);
      setEmail(profile.email);
      setDateOfBirth(profile.dateOfBirth);
      setAddress(profile.address ?? '');
      setPostalCode(profile.postalCode ? formatCanadianPostalCodeDisplay(profile.postalCode) : '');
      setProvinceId(profile.provinceId);
      setCenterId(profile.centerId);
      setProfilePhoto(
        profile.profilePhotoUrl
          ? storedImageFromPresignedReadUrl(
              resolveMediaDisplayUrl(profile.profilePhotoUrl) ?? profile.profilePhotoUrl,
            )
          : null,
      );
      setEmergencyContactName(profile.emergencyContactName);
      setEmergencyContactNumber(profileMobileDisplay(profile.emergencyContactNumber));
      setHasHealthCard(profile.hasHealthCard);
      setJerseySize(profile.jerseySize);
      setJerseyName(profile.jerseyName ?? '');
      setJerseyNumber(profile.jerseyNumber > 0 ? String(profile.jerseyNumber) : '');
      setProfileReady(true);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError ? err.message : 'Could not load your profile. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated') {
      void loadProfile();
    }
  }, [loadProfile, router, status]);

  function clearFieldError(key: keyof ProfileFieldErrors): void {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateForm(): boolean {
    const errors = validateProfileForm({
      profilePhotoError,
      firstName,
      lastName,
      email,
      dateOfBirth,
      postalCode,
      provinceId,
      centerId,
      emergencyContactName,
      emergencyContactNumber,
      jerseyName,
      jerseyNumber,
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onUpdateProfile(): Promise<void> {
    if (!validateForm()) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      let photoStorageKey: string | undefined =
        profilePhoto?.remoteUrl && isMediaStorageKey(profilePhoto.remoteUrl)
          ? profilePhoto.remoteUrl
          : undefined;

      if (profilePhoto && !photoStorageKey && isLocalImageUri(profilePhoto.uri)) {
        const sizeBytes = await resolveImageFileSize(profilePhoto.uri, profilePhoto.sizeBytes);
        if (sizeBytes == null || sizeBytes <= 0) {
          setFormError('Could not read the photo size. Please pick the image again.');
          return;
        }
        const uploadUri = await ensureUploadableUri(profilePhoto.uri, 'profile-photo');
        const uploaded = await uploadProfilePhoto(uploadUri, sizeBytes);
        if (!isMediaStorageKey(uploaded.storageKey)) {
          setFormError('Photo upload failed. Please try again.');
          return;
        }
        photoStorageKey = uploaded.storageKey;
        setProfilePhoto({
          ...profilePhoto,
          uri: uploaded.profilePhotoUrl,
          remoteUrl: uploaded.storageKey,
        });
      }

      const trimmedPostal = postalCode.trim();
      const trimmedEmail = email.trim();
      const jerseyNumParsed = jerseyNumber.trim() ? Number(jerseyNumber.trim()) : 0;

      const updated = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        provinceId: provinceId as string,
        centerId: centerId as string,
        dateOfBirth,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactNumber: emergencyContactNumber.replace(/\D/g, ''),
        hasHealthCard,
        ...(photoStorageKey !== undefined ? { profilePhotoUrl: photoStorageKey } : {}),
        email: trimmedEmail,
        ...(address.trim() ? { address: address.trim() } : { address: '' }),
        ...(trimmedPostal
          ? { postalCode: normalizeCanadianPostalCode(trimmedPostal) }
          : { postalCode: '' }),
        ...(jerseyName.trim() ? { jerseyName: jerseyName.trim() } : { jerseyName: null }),
        ...(jerseySize && isJerseySizeValue(jerseySize) ? { jerseySize } : { jerseySize: null }),
        jerseyNumber: jerseyNumParsed,
      });

      applyProfileUpdate(updated);
      setProfilePhoto(
        updated.profilePhotoUrl
          ? storedImageFromPresignedReadUrl(
              resolveMediaDisplayUrl(updated.profilePhotoUrl) ?? updated.profilePhotoUrl,
            )
          : null,
      );
      setProvinceId(updated.provinceId);
      setCenterId(updated.centerId);
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const formLoading = loading || !profileReady || !geographyReady;

  if (formLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
        <Text className="mt-3 font-sans text-sm text-on-surface-variant">Loading profile…</Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center font-sans text-base text-on-surface-variant">{loadError}</Text>
          <Button onPress={() => void loadProfile()} label="Retry" className="h-12 px-8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Edit Profile" onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        contentContainerClassName="px-4 pt-2"
        extraBottomPadding={48}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 items-center">
          <EditProfilePhoto
            uri={resolveMediaDisplayUrl(profilePhoto?.uri ?? null)}
            onChange={(file: PickedImageFile | null) => {
              setProfilePhoto(file ? pickedToStored(file) : null);
              if (file) {
                clearFieldError('profilePhoto');
              }
            }}
            onValidationError={setProfilePhotoError}
            error={fieldErrors.profilePhoto ?? profilePhotoError ?? undefined}
          />
        </View>

        <View className="gap-5">
          <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
            Personal Info
          </Text>

          <View className="flex-row items-start gap-3">
            <TextInput
              label="First Name"
              containerClassName="min-w-0 flex-1"
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
            />
            <TextInput
              label="Last Name"
              containerClassName="min-w-0 flex-1"
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
            />
          </View>

          <TextInput
            label="Mobile Number"
            value={mobileNumber}
            editable={false}
            selectTextOnFocus={false}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="0000000000"
            leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
            className="text-on-surface-variant"
            containerClassName="opacity-90"
          />

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
          />

          <DateField
            label="Date of Birth"
            value={dateOfBirth}
            onChange={(value) => {
              setDateOfBirth(value);
              clearFieldError('dateOfBirth');
            }}
            error={fieldErrors.dateOfBirth}
          />

          <TextInput
            label="Address"
            value={address}
            onChangeText={(text) => setAddress(formatSignupAddressInput(text))}
            placeholder="Street address"
          />

          <TextInput
            label="Postal Code"
            value={postalCode}
            onChangeText={(text) => {
              setPostalCode(formatCanadianPostalCodeInput(text));
              clearFieldError('postalCode');
            }}
            placeholder="A1A 1A1"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CANADIAN_POSTAL_CODE_DISPLAY_MAX_LENGTH}
            error={fieldErrors.postalCode}
          />

          <Select
            label="Province"
            placeholder="Select Province"
            value={provinceId}
            options={provinceOptions}
            onChange={onProvinceChange}
            loading={provinceField.loading}
            error={provinceSelectError}
            onRetry={provinceField.errorType === 'network' ? provinceField.retry : undefined}
            emptyMessage={
              provinceField.errorType === 'network'
                ? (provinceField.errorMessage ?? 'No options available.')
                : 'No provinces available.'
            }
            disabled={provinceField.errorType === 'empty'}
          />

          <Select
            label="Center"
            placeholder={provinceId ? 'Select Center' : 'Select province first'}
            value={centerId}
            options={centerOptions}
            onChange={(value) => {
              setCenterId(value);
              clearFieldError('center');
            }}
            loading={Boolean(provinceId) && centerField.loading}
            error={centerSelectError}
            onRetry={
              provinceId && centerField.errorType === 'network' ? centerField.retry : undefined
            }
            emptyMessage={
              centerField.errorType === 'network'
                ? (centerField.errorMessage ?? 'No options available.')
                : 'No centers available in this province.'
            }
            disabled={!provinceId || centerField.errorType === 'empty'}
          />
        </View>

        <View className="mt-8 gap-5">
          <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
            Health Section
          </Text>
          <Checkbox checked={hasHealthCard} onChange={setHasHealthCard}>
            <Text className="font-sans text-sm text-on-surface">Do you have a healthcard?</Text>
          </Checkbox>
        </View>

        <View className="mt-8 gap-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle-outline" size={18} color={FIELD_ORANGE} />
            <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
              Emergency Contact
            </Text>
          </View>
          <TextInput
            label="Contact Name"
            value={emergencyContactName}
            onChangeText={(text) => {
              setEmergencyContactName(formatSignupNameInput(text));
              clearFieldError('emergencyContactName');
            }}
            autoCapitalize="words"
            maxLength={SIGNUP_NAME_MAX_LENGTH}
            error={fieldErrors.emergencyContactName}
          />
          <TextInput
            label="Contact Number"
            value={emergencyContactNumber}
            onChangeText={(text) => {
              setEmergencyContactNumber(formatSignupMobileInput(text));
              clearFieldError('emergencyContactNumber');
            }}
            keyboardType="phone-pad"
            placeholder="0000000000"
            error={fieldErrors.emergencyContactNumber}
          />
        </View>

        <View className="mt-8 gap-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="shirt-outline" size={18} color={FIELD_ORANGE} />
            <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
              Equipment & Gear
            </Text>
          </View>
          <Select
            label="Jersey Size"
            placeholder="Select size"
            value={jerseySize}
            options={jerseySizeOptions}
            onChange={(value) => setJerseySize(value)}
          />
          <TextInput
            label="Jersey Name"
            value={jerseyName}
            onChangeText={(text) => {
              setJerseyName(formatSignupNameInput(text));
              clearFieldError('jerseyName');
            }}
            placeholder="e.g. Casablancas"
            autoCapitalize="words"
            maxLength={SIGNUP_NAME_MAX_LENGTH}
            error={fieldErrors.jerseyName}
          />
          <TextInput
            label="Jersey Number"
            value={jerseyNumber}
            onChangeText={(text) => {
              setJerseyNumber(text.replace(/\D/g, '').slice(0, 3));
              clearFieldError('jerseyNumber');
            }}
            keyboardType="number-pad"
            placeholder="13"
            error={fieldErrors.jerseyNumber}
          />
        </View>

        {formError ? (
          <View className="mt-6 rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{formError}</Text>
          </View>
        ) : null}

        <Button
          onPress={() => void onUpdateProfile()}
          disabled={submitting}
          className="mt-8 h-14"
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text className="font-sans-medium text-sm uppercase tracking-wider text-on-primary">
              Update Profile
            </Text>
          )}
        </Button>
      </KeyboardAwareFormScrollView>

      <SuccessDialog
        visible={showSuccessDialog}
        title="Profile updated"
        message="Your profile has been saved successfully."
        onDismiss={() => {
          setShowSuccessDialog(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
