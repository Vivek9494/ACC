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
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/ui/Button';
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
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provincesError, setProvincesError] = useState<string | null>(null);
  const [centersError, setCentersError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCenters, setLoadingCenters] = useState(false);

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
    setLoadingProvinces(true);
    setProvincesError(null);
    getProvinces()
      .then((list) => {
        if (cancelled) return;
        setProvinces(list);
        if (list.length === 0) {
          setProvincesError('No provinces available');
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load provinces for signup', err);
        if (!cancelled) {
          setProvinces([]);
          setProvincesError("Couldn't load provinces");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!province) {
      setCenters([]);
      setCenterId(null);
      setCentersError(null);
      setLoadingCenters(false);
      return;
    }
    let cancelled = false;
    setLoadingCenters(true);
    setCentersError(null);
    getCenters(province)
      .then((list) => {
        if (cancelled) return;
        setCenters(list);
        if (list.length === 0) {
          setCentersError('No centers available');
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load centers for signup', err);
        if (!cancelled) {
          setCenters([]);
          setCentersError("Couldn't load centers");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCenters(false);
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
    if (provincesError || provinces.length === 0) {
      return provincesError ?? 'No provinces available';
    }
    if (!centerId) {
      return centersError ?? (centers.length === 0
        ? 'No centers are available in the selected province yet.'
        : 'Please select your center.');
    }
    if (password.length < PASSWORD_MIN_LENGTH || !/[0-9]/.test(password)) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a digit.`;
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
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
          <ProfilePhotoField
            label="Profile Photo"
            uri={profilePhotoUri}
            onChange={setProfilePhotoUri}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="e.g. Rahul"
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="e.g. Sharma"
                autoCapitalize="words"
              />
            </View>
          </View>

          <TextInput
            label="Mobile Number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="0000000000"
            leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="rahul@example.com"
            leadingIcon={<Ionicons name="mail-outline" size={20} color={FIELD_ORANGE} />}
          />

          <DateField
            label="Date of Birth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
          />

          <Select
            label="Province"
            placeholder={
              loadingProvinces
                ? 'Loading…'
                : provincesError ?? (provinces.length === 0 ? 'No provinces available' : 'Select Province')
            }
            value={province}
            options={provinceOptions}
            onChange={onProvinceChange}
            disabled={loadingProvinces || Boolean(provincesError) || provinces.length === 0}
          />
          {provincesError ? (
            <Text className="-mt-3 font-sans text-sm text-error">{provincesError}</Text>
          ) : null}

          <Select
            label="Center"
            placeholder={
              !province
                ? 'Select Province first'
                : loadingCenters
                  ? 'Loading…'
                  : centersError ??
                    (centers.length === 0 ? 'No centers available' : 'Select Center')
            }
            value={centerId}
            options={centerSelectOptions}
            onChange={setCenterId}
            disabled={!province || loadingCenters || Boolean(centersError) || centers.length === 0}
          />
          {centersError && province ? (
            <Text className="-mt-3 font-sans text-sm text-error">{centersError}</Text>
          ) : null}

          <TextInput
            label="Password"
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
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="Relation / Name"
            />
            <TextInput
              label="Contact Number"
              value={emergencyContactNumber}
              onChangeText={setEmergencyContactNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="0000000000"
              leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
            />
          </SectionCard>

          {error ? (
            <View className="rounded-xl bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{error}</Text>
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
