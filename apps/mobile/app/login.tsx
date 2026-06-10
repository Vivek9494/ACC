import { AuthErrorCode } from '@acc/types';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/ui/Button';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import {
  LOGIN_MESSAGES,
  loginMobileForApi,
  validateLoginMobile,
  validateLoginPassword,
} from '../src/lib/login-messages';

function mapLoginApiError(err: unknown): string {
  if (!(err instanceof ApiRequestError)) {
    return LOGIN_MESSAGES.genericError;
  }
  if (err.status === 429 || err.error.code === AuthErrorCode.TooManyAttempts) {
    return LOGIN_MESSAGES.tooManyAttempts;
  }
  if (err.status === 401 && err.error.code === AuthErrorCode.InvalidCredentials) {
    return LOGIN_MESSAGES.invalidCredentials;
  }
  return LOGIN_MESSAGES.genericError;
}

export default function LoginScreen(): React.ReactElement {
  const { signIn } = useAuth();
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onMobileChange(text: string): void {
    setMobileNumber(text);
    if (mobileError !== undefined) {
      setMobileError(validateLoginMobile(text));
    }
  }

  function onPasswordChange(text: string): void {
    setPassword(text);
    if (passwordError !== undefined) {
      setPasswordError(validateLoginPassword(text));
    }
  }

  async function onSubmit(): Promise<void> {
    const nextMobileError = validateLoginMobile(mobileNumber);
    const nextPasswordError = validateLoginPassword(password);
    setMobileError(nextMobileError);
    setPasswordError(nextPasswordError);
    if (nextMobileError || nextPasswordError) {
      setFormError(null);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await signIn({
        mobileNumber: loginMobileForApi(mobileNumber),
        password,
      });
      // Navigation to /home is handled by the root navigator on status change.
    } catch (err) {
      setFormError(mapLoginApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="flex-grow px-6 py-12" keyboardShouldPersistTaps="handled">
        <View className="mt-8 gap-2">
          <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
            Atmiya Cricket Club
          </Text>
          <Text className="font-sans-bold text-3xl text-on-surface">Welcome back</Text>
          <Text className="font-sans text-base text-on-surface-variant">
            Log in with your mobile number and password.
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <TextInput
            label="Mobile number"
            value={mobileNumber}
            onChangeText={onMobileChange}
            keyboardType="phone-pad"
            autoCapitalize="none"
            maxLength={10}
            placeholder="Enter Mobile Number"
            error={mobileError}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            error={passwordError}
            rightAccessory={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            }
          />

          <Link href="/forgot-password" className="self-end font-sans-semibold text-sm text-primary">
            Forgot password?
          </Link>

          {formError ? (
            <View className="rounded-lg bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{formError}</Text>
            </View>
          ) : null}

          <Button onPress={() => void onSubmit()} disabled={submitting} className="mt-2 h-14">
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-sans-medium text-sm uppercase tracking-wider text-on-primary">
                Log in
              </Text>
            )}
          </Button>

          <Pressable
            onPress={() => router.replace('/guest')}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
            className="items-center py-3 active:opacity-80"
          >
            <Text className="font-sans-semibold text-sm text-primary">Continue as Guest</Text>
          </Pressable>
        </View>

        <View className="mt-auto flex-row justify-center gap-1 pt-6">
          <Text className="font-sans text-sm text-on-surface-variant">New to ACC?</Text>
          <Link href="/signup" className="font-sans-semibold text-sm text-primary">
            Create an account
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
