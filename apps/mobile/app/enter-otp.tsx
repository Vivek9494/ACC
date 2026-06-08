import { OTP_LENGTH } from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpInput } from '../src/components/OtpInput';
import { ApiRequestError, forgotPassword } from '../src/lib/api';

export default function EnterOtpScreen(): React.ReactElement {
  const router = useRouter();
  const { mobile } = useLocalSearchParams<{ mobile?: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function onContinue(): void {
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setError(null);
    router.push({ pathname: '/reset-password', params: { mobile: mobile ?? '', otp } });
  }

  async function onResend(): Promise<void> {
    if (!mobile) return;
    setResending(true);
    setResent(false);
    try {
      await forgotPassword({ mobileNumber: mobile });
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="flex-grow px-6 py-12" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="mb-6 self-start">
          <Text className="font-sans-medium text-sm text-primary">← Back</Text>
        </Pressable>

        <View className="gap-2">
          <Text className="font-sans-bold text-3xl text-on-surface">Check your phone</Text>
          <Text className="font-sans text-base text-on-surface-variant">
            Enter the {OTP_LENGTH}-digit code sent to{' '}
            <Text className="font-sans-semibold text-on-surface">{mobile ?? 'your number'}</Text>.
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} autoFocus />

          {error ? (
            <View className="rounded-lg bg-error-container px-4 py-3">
              <Text className="font-sans text-sm text-on-error-container">{error}</Text>
            </View>
          ) : null}

          <Button
            onPress={onContinue}
            className="mt-2 h-14"
            textClassName="font-sans-medium text-sm uppercase tracking-wider"
            label="Continue"
          />

          <View className="flex-row justify-center gap-1 pt-2">
            <Text className="font-sans text-sm text-on-surface-variant">
              Didn't receive the code?
            </Text>
            <Pressable onPress={() => void onResend()} disabled={resending}>
              <Text className="font-sans-semibold text-sm text-primary">
                {resending ? 'Sending…' : resent ? 'Sent' : 'Resend'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
