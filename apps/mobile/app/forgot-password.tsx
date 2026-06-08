import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '../src/components/FormField';
import { ApiRequestError, forgotPassword } from '../src/lib/api';

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(): Promise<void> {
    if (!mobileNumber.trim()) {
      setError('Enter your mobile number.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword({ mobileNumber: mobileNumber.trim() });
      router.push({ pathname: '/enter-otp', params: { mobile: mobileNumber.trim() } });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="flex-grow px-6 py-12" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="mb-6 self-start">
          <Text className="font-sans-medium text-sm text-primary">← Back</Text>
        </Pressable>

        <View className="gap-2">
          <Text className="font-sans-bold text-3xl text-on-surface">Forgot password</Text>
          <Text className="font-sans text-base text-on-surface-variant">
            Enter your mobile number and we'll send you a 6-digit code to reset your password.
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <FormField
            label="Mobile number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="+1 555 000 0000"
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
                Send code
              </Text>
            )}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
