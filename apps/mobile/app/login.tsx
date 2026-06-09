import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';

export default function LoginScreen(): React.ReactElement {
  const { signIn } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ mobileNumber: mobileNumber.trim(), password });
      // Navigation to /home is handled by the root navigator on status change.
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong. Please try again.',
      );
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
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="Enter Mobile Number"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
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
                Log in
              </Text>
            )}
          </Button>
        </View>

        <View className="mt-auto flex-row justify-center gap-1 pt-10">
          <Text className="font-sans text-sm text-on-surface-variant">New to ACC?</Text>
          <Link href="/signup" className="font-sans-semibold text-sm text-primary">
            Create an account
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
