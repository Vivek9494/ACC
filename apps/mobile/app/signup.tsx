import { Ionicons } from '@expo/vector-icons';
import {
  MIN_SIGNUP_AGE,
  PASSWORD_MIN_LENGTH,
  type CenterSummary,
  type ProvinceSummary,
  type SignupRequest,
} from '@acc/types';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/ui/Button';
import { Checkbox } from '../src/components/ui/Checkbox';
import { DateField } from '../src/components/ui/DateField';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { ProfilePhotoField } from '../src/components/ui/ProfilePhotoField';
import { SectionCard } from '../src/components/ui/SectionCard';
import { Select } from '../src/components/ui/Select';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, getCenters, getProvinces } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STRONG_LABEL = 'strong' as const;

function ageInYears(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export default function SignupScreen(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [province, setProvince] = useState<string | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );
  const centerSelectOptions = useMemo(
    () => centers.map((c) => ({ value: c.id, label: c.name })),
    [centers],
  );

  useEffect(() => {
    let cancelled = false;
    getProvinces()
      .then((list) => {
        if (!cancelled) setProvinces(list);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load provinces. Check your connection.');
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!province) {
      setCenters([]);
      setCenterId(null);
      return;
    }
    let cancelled = false;
    getCenters(province)
      .then((list) => {
        if (!cancelled) setCenters(list);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load centers. Check your connection.');
      });
    return () => {
      cancelled = true;
    };
  }, [province]);

  function onProvinceChange(next: string): void {
    setProvince(next);
    setCenterId(null);
  }

  function validate(): string | null {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !mobileNumber.trim() ||
      !email.trim() ||
      !emergencyContactName.trim() ||
      !emergencyContactNumber.trim()
    ) {
      return 'Please fill in all required fields.';
    }
    if (!DATE_RE.test(dateOfBirth)) {
      return 'Date of birth must be in YYYY-MM-DD format.';
    }
    const dob = new Date(dateOfBirth);
    if (ageInYears(dob, new Date()) < MIN_SIGNUP_AGE) {
      return `You must be at least ${MIN_SIGNUP_AGE} years old to register.`;
    }
    if (!province) {
      return 'Please select your province.';
    }
    if (!centerId) {
      return centers.length === 0
        ? 'No centers are available in the selected province yet.'
        : 'Please select your center.';
    }
    if (!/^\d+$/.test(jerseyNumber)) {
      return 'Jersey number must be a number.';
    }
    if (password.length < PASSWORD_MIN_LENGTH || !/[0-9]/.test(password)) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a digit.`;
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    if (!termsAccepted) {
      return 'Please accept the Terms of Service and Privacy Policy.';
    }
    return null;
  }

  async function onSubmit(): Promise<void> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: SignupRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim(),
        dateOfBirth,
        centerId: centerId as string,
        jerseyNumber: Number(jerseyNumber),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactNumber: emergencyContactNumber.trim(),
        password,
        // profilePhotoUrl omitted until S3 upload is wired; local URI kept in UI only.
      };
      await register(payload);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openTerms(): void {
    void Linking.openURL('https://atmiyacricketclub.ca/terms').catch(() => {
      Alert.alert('Terms of Service', 'Terms link will be available on the club website.');
    });
  }

  function openPrivacy(): void {
    void Linking.openURL('https://atmiyacricketclub.ca/privacy').catch(() => {
      Alert.alert('Privacy Policy', 'Privacy link will be available on the club website.');
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-[#F1F1F1] px-4 py-3">
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
        contentContainerClassName="px-4 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 gap-2">
          <Text className="font-sans-bold text-3xl text-[#F37021]">Join the Club</Text>
          <Text className="font-sans text-base leading-6 text-[#5A4136]">
            Complete your profile to start your journey with Hariprabodham Sports Club.
          </Text>
        </View>

        <View className="gap-5">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextInput
                label="First Name"
                labelVariant={STRONG_LABEL}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="e.g. Rahul"
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="Last Name"
                labelVariant={STRONG_LABEL}
                value={lastName}
                onChangeText={setLastName}
                placeholder="e.g. Sharma"
                autoCapitalize="words"
              />
            </View>
          </View>

          <TextInput
            label="Mobile Number"
            labelVariant={STRONG_LABEL}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="+91 00000 00000"
            leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
          />

          <TextInput
            label="Email"
            labelVariant={STRONG_LABEL}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="rahul@example.com"
            leadingIcon={<Ionicons name="mail-outline" size={20} color={FIELD_ORANGE} />}
          />

          <DateField
            label="Date of Birth"
            labelVariant={STRONG_LABEL}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            placeholder="yyyy-mm-dd"
          />

          <Select
            label="Province"
            labelVariant={STRONG_LABEL}
            placeholder={loadingLocations ? 'Loading…' : 'Select Province'}
            value={province}
            options={provinceOptions}
            onChange={onProvinceChange}
            disabled={loadingLocations}
          />

          <Select
            label="Center"
            labelVariant={STRONG_LABEL}
            placeholder={
              province
                ? centers.length === 0
                  ? 'No centers in this province'
                  : 'Select Center'
                : 'Select Province first'
            }
            value={centerId}
            options={centerSelectOptions}
            onChange={setCenterId}
            disabled={!province || centers.length === 0}
          />

          <TextInput
            label="Jersey Number"
            labelVariant={STRONG_LABEL}
            value={jerseyNumber}
            onChangeText={setJerseyNumber}
            keyboardType="number-pad"
            placeholder="7"
          />

          <ProfilePhotoField
            label="Profile Photo"
            labelVariant={STRONG_LABEL}
            uri={profilePhotoUri}
            onChange={setProfilePhotoUri}
          />

          <TextInput
            label="Password"
            labelVariant={STRONG_LABEL}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            leadingIcon={<Ionicons name="lock-closed-outline" size={20} color={FIELD_ORANGE} />}
            rightAccessory={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            }
          />

          <TextInput
            label="Confirm Password"
            labelVariant={STRONG_LABEL}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            placeholder="••••••••"
            leadingIcon={<Ionicons name="lock-closed-outline" size={20} color={FIELD_ORANGE} />}
            rightAccessory={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            }
          />

          <SectionCard
            icon={<Ionicons name="alert-circle" size={20} color={FIELD_ORANGE} />}
            heading="Emergency Contact"
          >
            <TextInput
              label="Contact Name"
              labelVariant={STRONG_LABEL}
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="Relation / Name"
            />
            <TextInput
              label="Contact Number"
              labelVariant={STRONG_LABEL}
              value={emergencyContactNumber}
              onChangeText={setEmergencyContactNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="+91 00000 00000"
              leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
            />
          </SectionCard>

          <Checkbox checked={termsAccepted} onChange={setTermsAccepted}>
            <Text className="font-sans text-sm leading-5 text-[#5A4136]">
              I agree to the{' '}
              <Text className="font-sans-bold text-[#F37021]" onPress={openTerms}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text className="font-sans-bold text-[#F37021]" onPress={openPrivacy}>
                Privacy Policy
              </Text>{' '}
              regarding my participation in sports activities.
            </Text>
          </Checkbox>

          {error ? (
            <View className="rounded-xl bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{error}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onSubmit()}
            disabled={submitting || !termsAccepted}
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
            <Link href="/login" className="font-sans-semibold text-sm text-[#F37021]">
              Log in
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
