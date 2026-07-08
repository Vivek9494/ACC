import { colors } from '@/theme/colors';
import {
  AuthErrorCode,
  CHANGE_PASSWORD_MESSAGES,
  isPasswordPolicyCompliant,
  PASSWORD_POLICY_INVALID_MESSAGE,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordRequirements } from '../src/components/ui/PasswordRequirements';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Button } from '../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../src/components/ui/KeyboardAwareFormScrollView';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { ApiRequestError, completeForcedPasswordChange } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { homeRouteForUser } from '../src/lib/home-route';

export default function ForcedPasswordChangeScreen(): React.ReactElement {
  const router = useRouter();
  const { user, clearMustChangePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      await completeForcedPasswordChange({ newPassword: password });
      clearMustChangePassword();
      if (user) {
        router.replace(homeRouteForUser({ ...user, mustChangePassword: undefined }));
      } else {
        router.replace('/home');
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <KeyboardAwareFormScrollView contentContainerClassName="flex-grow px-6 py-8">
        <View className="items-center">
          <View className="mb-6 rounded-full bg-primary-fixed p-5">
            <Ionicons name="lock-open-outline" size={40} color={FIELD_ORANGE} />
          </View>
          <Text className="text-center font-sans-bold text-3xl text-on-surface">
            Set a new password
          </Text>
          <Text className="mt-3 text-center font-sans text-base text-on-surface-variant">
            Your account requires a new password before you can continue.
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
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
