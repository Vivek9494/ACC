import { AuthErrorCode, CHANGE_PASSWORD_MESSAGES, isPasswordPolicyCompliant } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SuccessDialog } from '../src/components/ui/SuccessDialog';
import { PasswordRequirements } from '../src/components/ui/PasswordRequirements';
import { PasswordToggle } from '../src/components/ui/PasswordToggle';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../src/components/ui/fieldStyles';
import { ApiRequestError, changePassword } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';

export default function ChangePasswordScreen(): React.ReactElement {
  const router = useRouter();
  const { status, clearCredentials, markUnauthenticated } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [newError, setNewError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const navigatedRef = useRef(false);

  const goToLogin = useCallback(() => {
    if (navigatedRef.current) {
      return;
    }
    navigatedRef.current = true;
    setShowSuccessDialog(false);
    markUnauthenticated();
    router.replace('/login');
  }, [markUnauthenticated, router]);

  const canSubmit = useMemo(() => {
    if (!currentPassword.trim()) {
      return false;
    }
    if (!isPasswordPolicyCompliant(newPassword)) {
      return false;
    }
    if (newPassword !== confirmPassword) {
      return false;
    }
    if (newPassword === currentPassword) {
      return false;
    }
    return true;
  }, [confirmPassword, currentPassword, newPassword]);

  useEffect(() => {
    if (status === 'unauthenticated' && !showSuccessDialog && !navigatedRef.current) {
      router.replace('/login');
    }
  }, [router, showSuccessDialog, status]);

  function validateFields(): boolean {
    let valid = true;
    setCurrentError(undefined);
    setNewError(undefined);
    setConfirmError(undefined);

    if (!currentPassword.trim()) {
      setCurrentError(CHANGE_PASSWORD_MESSAGES.currentRequired);
      valid = false;
    }
    if (newPassword === currentPassword && newPassword.length > 0) {
      setNewError(CHANGE_PASSWORD_MESSAGES.sameAsCurrent);
      valid = false;
    }
    if (confirmPassword !== newPassword) {
      setConfirmError(CHANGE_PASSWORD_MESSAGES.confirmMismatch);
      valid = false;
    }
    return valid;
  }

  async function onSubmit(): Promise<void> {
    if (!validateFields() || !canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      await clearCredentials();
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.error.code === AuthErrorCode.CurrentPasswordIncorrect) {
          setCurrentError(CHANGE_PASSWORD_MESSAGES.currentIncorrect);
        } else if (err.error.code === AuthErrorCode.SamePassword) {
          setNewError(CHANGE_PASSWORD_MESSAGES.sameAsCurrent);
        } else {
          setCurrentError(err.message);
        }
      } else {
        setCurrentError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="flex-grow px-6 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="p-1 active:opacity-80"
          >
            <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
          </Pressable>
          <Text className="font-sans-bold text-xl text-on-surface">Change Password</Text>
        </View>

        <Text className="mb-8 font-sans text-base text-on-surface-variant">
          Your new password must be different from current password.
        </Text>

        <View className="gap-5">
          <TextInput
            label="Current Password"
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              if (currentError) setCurrentError(undefined);
            }}
            secureTextEntry={!showCurrent}
            placeholder="••••••••"
            rightAccessory={
              <PasswordToggle visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            }
            error={currentError}
          />

          <TextInput
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (text.length > 0 && text === currentPassword) {
                setNewError(CHANGE_PASSWORD_MESSAGES.sameAsCurrent);
              } else {
                setNewError(undefined);
              }
            }}
            secureTextEntry={!showNew}
            placeholder="••••••••"
            rightAccessory={
              <PasswordToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} />
            }
            error={newError}
          />

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (text.length > 0 && text !== newPassword) {
                setConfirmError(CHANGE_PASSWORD_MESSAGES.confirmMismatch);
              } else {
                setConfirmError(undefined);
              }
            }}
            secureTextEntry={!showConfirm}
            placeholder="••••••••"
            rightAccessory={
              <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            }
            error={confirmError}
          />

          <PasswordRequirements password={newPassword} />

          <Button
            onPress={() => void onSubmit()}
            disabled={!canSubmit || submitting}
            className="mt-2 h-14 flex-row gap-2"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text className="font-sans-medium text-sm uppercase tracking-wider text-on-primary">
                  Set New Password
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </>
            )}
          </Button>
        </View>
      </ScrollView>

      <SuccessDialog
        visible={showSuccessDialog}
        title="Password Changed"
        message="Please log in again with your new password."
        autoDismissMs={3000}
        onDismiss={goToLogin}
      />
    </SafeAreaView>
  );
}
