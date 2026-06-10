import {
  CHANGE_PASSWORD_MESSAGES,
  isPasswordPolicyCompliant,
  SIGNUP_VALIDATION_MESSAGES,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordRequirements } from '../src/components/ui/PasswordRequirements';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, resetPassword } from '../src/lib/api';

export default function ResetPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const { mobile, otp } = useLocalSearchParams<{ mobile?: string; otp?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = useMemo(
    () => isPasswordPolicyCompliant(password) && password === confirmPassword && confirmPassword.length > 0,
    [confirmPassword, password],
  );

  async function onSubmit(): Promise<void> {
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(null);

    if (!isPasswordPolicyCompliant(password)) {
      setPasswordError(SIGNUP_VALIDATION_MESSAGES.password.invalid);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError(CHANGE_PASSWORD_MESSAGES.confirmMismatch);
      return;
    }
    if (!mobile || !otp) {
      setFormError('Missing verification details. Please restart the reset flow.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ mobileNumber: mobile, otp, newPassword: password });
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 justify-between px-6 py-12">
          <View className="mt-16 gap-3">
            <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
              All set
            </Text>
            <Text className="font-sans-bold text-3xl text-on-surface">Password updated</Text>
            <Text className="font-sans text-base text-on-surface-variant">
              Your password has been reset. Log in with your new password.
            </Text>
          </View>
          <Button
            onPress={() => router.replace('/login')}
            className="h-14"
            textClassName="font-sans-medium text-sm uppercase tracking-wider"
            label="Back to log in"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="flex-grow px-6 py-12" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="mb-6 self-start">
          <Text className="font-sans-medium text-sm text-primary">← Back</Text>
        </Pressable>

        <View className="gap-2">
          <Text className="font-sans-bold text-3xl text-on-surface">Set a new password</Text>
          <Text className="font-sans text-base text-on-surface-variant">
            Choose a new password for your account.
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <TextInput
            label="New password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(undefined);
            }}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            rightAccessory={
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            }
            error={passwordError}
          />

          <TextInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmError) setConfirmError(undefined);
            }}
            secureTextEntry={!showConfirmPassword}
            placeholder="••••••••"
            rightAccessory={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            }
            error={confirmError}
          />

          <PasswordRequirements password={password} />

          {formError ? (
            <View className="rounded-lg bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{formError}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onSubmit()}
            disabled={!canSubmit || submitting}
            className="mt-2 h-14"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-sans-medium text-sm uppercase tracking-wider text-on-primary">
                Reset password
              </Text>
            )}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
