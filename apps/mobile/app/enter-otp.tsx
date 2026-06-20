import { colors } from '@/theme/colors';
import {
  formatCanadianMobileMasked,
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpInput } from '../src/components/OtpInput';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { forgotPassword, verifyResetOtp } from '../src/lib/api';
import { FIELD_ORANGE } from '@/components/ui/fieldStyles';
import {
  mapPasswordResetApiError,
  PASSWORD_RESET_MESSAGES,
} from '../src/lib/password-reset-messages';

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function EnterOtpScreen(): React.ReactElement {
  const router = useRouter();
  const { mobile } = useLocalSearchParams<{ mobile?: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const maskedNumber = mobile ? formatCanadianMobileMasked(mobile) : '+1 (***) ***-****';

  const onVerify = useCallback(async (): Promise<void> => {
    if (otp.length !== OTP_LENGTH) {
      setError(PASSWORD_RESET_MESSAGES.otpRequired);
      return;
    }
    if (!mobile) {
      setError(PASSWORD_RESET_MESSAGES.resetTokenMissing);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const { resetToken } = await verifyResetOtp({ mobileNumber: mobile, otp });
      router.push({ pathname: '/reset-password', params: { resetToken } });
    } catch (err) {
      setError(mapPasswordResetApiError(err));
    } finally {
      setSubmitting(false);
    }
  }, [mobile, otp, router]);

  async function onResend(): Promise<void> {
    if (!mobile || cooldown > 0 || resending) {
      return;
    }
    setResending(true);
    setError(null);
    try {
      await forgotPassword({ mobileNumber: mobile });
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setOtp('');
    } catch (err) {
      setError(mapPasswordResetApiError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <Text className="font-sans-bold text-xl text-on-surface">Verify OTP</Text>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow items-center px-6 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8 rounded-full bg-surface-container-lowest p-6 shadow-sm">
          <Ionicons name="shield-checkmark" size={48} color={FIELD_ORANGE} />
        </View>

        <View className="items-center gap-2">
          <Text className="font-sans-bold text-2xl text-on-surface">Check your phone</Text>
          <Text className="max-w-xs text-center font-sans text-sm text-on-surface-variant">
            Enter the {OTP_LENGTH}-digit code sent to your mobile number{' '}
            <Text className="font-sans-semibold text-on-surface">{maskedNumber}</Text>
          </Text>
        </View>

        <View className="mt-10 w-full max-w-sm gap-5">
          <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} autoFocus />

          {error ? (
            <View className="rounded-lg bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{error}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onVerify()}
            disabled={otp.length !== OTP_LENGTH || submitting}
            className="h-14"
            label={submitting ? undefined : 'Verify & Proceed'}
          >
            {submitting ? <ActivityIndicator color={colors.textInverse} /> : null}
          </Button>

          <View className="items-center gap-1 pt-2">
            <View className="flex-row flex-wrap justify-center gap-1">
              <Text className="font-sans text-sm text-on-surface-variant">
                Didn&apos;t receive the code?
              </Text>
              <Pressable
                onPress={() => void onResend()}
                disabled={resending || cooldown > 0}
                accessibilityRole="button"
              >
                <Text
                  className={`font-sans-semibold text-sm ${cooldown > 0 ? 'text-on-surface-variant' : 'text-primary'}`}
                >
                  {resending ? 'Sending…' : 'Resend OTP'}
                </Text>
              </Pressable>
            </View>
            {cooldown > 0 ? (
              <Text className="font-sans text-xs text-on-surface-variant">
                Resend available in {formatCountdown(cooldown)}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
