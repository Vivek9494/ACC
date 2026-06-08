import { PASSWORD_MIN_LENGTH } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '../src/components/FormField';
import { ApiRequestError, resetPassword } from '../src/lib/api';

export default function ResetPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const { mobile, otp } = useLocalSearchParams<{ mobile?: string; otp?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(): Promise<void> {
    if (password.length < PASSWORD_MIN_LENGTH || !/[0-9]/.test(password)) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a digit.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!mobile || !otp) {
      setError('Missing verification details. Please restart the reset flow.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({ mobileNumber: mobile, otp, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(
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
          <FormField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 chars, 1 digit"
          />
          <FormField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          {error ? (
            <View className="rounded-lg bg-error-container px-4 py-3">
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
