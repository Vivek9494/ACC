import { formatSignupMobileInput, OTP_LENGTH, SIGNUP_MOBILE_LENGTH } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

import { Button } from '../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../src/components/ui/KeyboardAwareFormScrollView';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, forgotPassword } from '../src/lib/api';
import { FIELD_ORANGE } from '@/components/ui/fieldStyles';
import { loginMobileForApi, validateLoginMobile } from '../src/lib/login-messages';
import {
  mapPasswordResetApiError,
  PASSWORD_RESET_MESSAGES,
} from '../src/lib/password-reset-messages';

export default function ForgotPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onMobileChange(text: string): void {
    setMobileNumber(formatSignupMobileInput(text));
    if (mobileError !== undefined) {
      setMobileError(validateLoginMobile(formatSignupMobileInput(text)));
    }
  }

  async function onSubmit(): Promise<void> {
    const nextMobileError = validateLoginMobile(mobileNumber);
    setMobileError(nextMobileError);
    if (nextMobileError) {
      setError(null);
      return;
    }

    setError(null);
    setSubmitting(true);
    const apiMobile = loginMobileForApi(mobileNumber);
    try {
      await forgotPassword({ mobileNumber: apiMobile });
      router.push({ pathname: '/enter-otp', params: { mobile: apiMobile } });
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? mapPasswordResetApiError(err) : PASSWORD_RESET_MESSAGES.genericError,
      );
    } finally {
      setSubmitting(false);
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
        <Text className="font-sans-bold text-xl text-on-surface">Forgot password</Text>
      </View>

      <KeyboardAwareFormScrollView
        contentContainerClassName="px-4 pt-4"
        extraBottomPadding={48}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Text className="font-sans-bold text-3xl text-on-surface">Reset your password</Text>
          <Text className="font-sans text-base text-on-surface-variant">
            Enter your Canadian mobile number and we&apos;ll send a {OTP_LENGTH}-digit verification code.
          </Text>
        </View>

        <View className="mt-10 gap-5">
          <TextInput
            label="Mobile number"
            value={mobileNumber}
            onChangeText={onMobileChange}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="0000000000"
            maxLength={SIGNUP_MOBILE_LENGTH}
            leadingIcon={<Ionicons name="call-outline" size={20} color={FIELD_ORANGE} />}
            error={mobileError}
          />
          <Text className="font-sans text-sm text-on-surface-variant">
            Canada (+1) — enter your 10-digit mobile number without the country code.
          </Text>

          {error ? (
            <View className="rounded-lg bg-primary-50 px-4 py-3">
              <Text className="font-sans text-sm text-primary">{error}</Text>
            </View>
          ) : null}

          <Button
            onPress={() => void onSubmit()}
            disabled={submitting}
            className="mt-2 h-14"
            label={submitting ? undefined : 'Send code'}
          >
            {submitting ? <ActivityIndicator color={colors.textInverse} /> : null}
          </Button>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
