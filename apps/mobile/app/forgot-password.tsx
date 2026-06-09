import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '../src/components/FormField';
import { ApiRequestError, forgotPassword } from '../src/lib/api';
import { FIELD_ORANGE } from '@/components/ui/fieldStyles';

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
      <View className="flex-row items-center gap-3 px-4 py-3">
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
            placeholder="0000000000"
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
