import { APP_ORG_NAME, APP_SHORT_NAME, AuthErrorCode } from '@acc/types';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

import { Button } from '../src/components/ui/Button';
import { Checkbox } from '../src/components/ui/Checkbox';
import { KeyboardAwareFormScrollView } from '../src/components/ui/KeyboardAwareFormScrollView';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, SessionExpiredError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import {
  LOGIN_MESSAGES,
  loginMobileForApi,
  validateLoginMobile,
  validateLoginPassword,
} from '../src/lib/login-messages';
import {
  loadRememberMePreferences,
  saveRememberedMobile,
  saveRememberMeFlag,
} from '../src/lib/remember-me';

function mapLoginApiError(err: unknown): string {
  if (err instanceof SessionExpiredError) {
    return LOGIN_MESSAGES.genericError;
  }
  if (!(err instanceof ApiRequestError)) {
    if (err instanceof Error && err.message.includes('Network request failed')) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return LOGIN_MESSAGES.genericError;
  }
  if (err.status === 429 || err.error.code === AuthErrorCode.TooManyAttempts) {
    return LOGIN_MESSAGES.tooManyAttempts;
  }
  if (err.status === 401 && err.error.code === AuthErrorCode.InvalidCredentials) {
    return LOGIN_MESSAGES.invalidCredentials;
  }
  if (err.status === 401 && err.error.code === AuthErrorCode.TempPasswordExpired) {
    return LOGIN_MESSAGES.tempPasswordExpired;
  }
  return LOGIN_MESSAGES.genericError;
}

export default function LoginScreen(): React.ReactElement {
  const { signIn } = useAuth();
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = await loadRememberMePreferences();
      if (cancelled) {
        return;
      }
      setRememberMe(prefs.rememberMe);
      if (prefs.mobileNumber) {
        setMobileNumber(prefs.mobileNumber);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function onRememberMeChange(checked: boolean): void {
    setRememberMe(checked);
    void saveRememberMeFlag(checked);
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
      const localMobile = mobileNumber.trim();
      await signIn({
        mobileNumber: loginMobileForApi(localMobile),
        password: password.trim(),
        rememberMe,
      });
      if (rememberMe) {
        await saveRememberedMobile(localMobile);
      } else {
        await saveRememberMeFlag(false);
      }
    } catch (err) {
      setFormError(mapLoginApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareFormScrollView contentContainerClassName="flex-grow px-6 py-12">
        <View className="mt-8 gap-2">
          <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
            {APP_ORG_NAME}
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

          <Checkbox checked={rememberMe} onChange={onRememberMeChange}>
            <Text className="font-sans text-base text-on-surface">Remember Me</Text>
          </Checkbox>

          <Link href="/forgot-password" className="self-end font-sans-semibold text-sm text-primary">
            Forgot password?
          </Link>

          {formError ? (
            <View className="rounded-lg bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{formError}</Text>
            </View>
          ) : null}

          <Button onPress={() => void onSubmit()} disabled={submitting} className="mt-2 h-14">
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} />
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
          <Text className="font-sans text-sm text-on-surface-variant">New to {APP_SHORT_NAME}?</Text>
          <Link href="/signup" className="font-sans-semibold text-sm text-primary">
            Create an account
          </Link>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
