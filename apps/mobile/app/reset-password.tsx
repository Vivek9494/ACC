import { colors } from '@/theme/colors';
import {
  AuthErrorCode,
  CHANGE_PASSWORD_MESSAGES,
  isPasswordPolicyCompliant,
  PASSWORD_POLICY_INVALID_MESSAGE,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordRequirements } from '../src/components/ui/PasswordRequirements';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, resetPassword } from '../src/lib/api';
import { FIELD_ORANGE } from '@/components/ui/fieldStyles';
import {
  mapPasswordResetApiError,
  PASSWORD_RESET_MESSAGES,
} from '../src/lib/password-reset-messages';

export default function ResetPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const { resetToken } = useLocalSearchParams<{ resetToken?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectToForgotPassword = useCallback(() => {
    router.replace('/forgot-password');
  }, [router]);

  useEffect(() => {
    if (!resetToken) {
      redirectToForgotPassword();
    }
  }, [resetToken, redirectToForgotPassword]);

  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const canSubmit = useMemo(
    () =>
      isPasswordPolicyCompliant(password) &&
      password === confirmPassword &&
      confirmPassword.length > 0,
    [confirmPassword, password],
  );

  async function onSubmit(): Promise<void> {
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(null);

    if (!isPasswordPolicyCompliant(password)) {
      setPasswordError(PASSWORD_POLICY_INVALID_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError(CHANGE_PASSWORD_MESSAGES.confirmMismatch);
      return;
    }
    if (!resetToken) {
      redirectToForgotPassword();
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ resetToken, newPassword: password });
      router.replace('/login');
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.error.code === AuthErrorCode.ResetTokenInvalid
      ) {
        redirectToForgotPassword();
        return;
      }
      setFormError(mapPasswordResetApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!resetToken) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 border-b border-outline-variant/30 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-primary">Reset Password</Text>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center">
          <View className="mb-6 rounded-full bg-primary-fixed p-5">
            <Ionicons name="lock-open-outline" size={40} color={FIELD_ORANGE} />
          </View>
          <Text className="text-center font-sans-bold text-3xl text-on-surface">
            Create New Password
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <TextInput
            label="New Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(undefined);
            }}
            secureTextEntry={!showPassword}
            placeholder="Enter your new password"
            rightAccessory={
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            }
            error={passwordError}
          />

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmError) setConfirmError(undefined);
            }}
            secureTextEntry={!showConfirmPassword}
            placeholder="Re-enter your new password"
            rightAccessory={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            }
            error={
              confirmMismatch ? CHANGE_PASSWORD_MESSAGES.confirmMismatch : confirmError
            }
          />

          <PasswordRequirements password={password} />

          {formError ? (
            <View className="rounded-lg bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{formError}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onSubmit()}
            disabled={!canSubmit || submitting}
            className="mt-2 h-14"
            label={submitting ? undefined : 'Set New Password'}
          >
            {submitting ? <ActivityIndicator color={colors.textInverse} /> : null}
          </Button>

          <View className="items-center pt-4">
            <Text className="font-sans text-sm text-on-surface-variant">
              Remember your password?{' '}
              <Link href="/login" className="font-sans-bold text-primary">
                Login here
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
