import type { AdminUserDetail } from '@acc/types';
import {
  formatAdminTempPasswordTimeRemaining,
  isAdminTempPasswordActive,
} from '@acc/types';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { copyTextToClipboard } from '../../lib/copy-text';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

export interface AdminUserSecuritySectionProps {
  user: AdminUserDetail;
  revealedTempPassword: string | null;
  onRegenerateTempPassword: () => void;
  regenerating?: boolean;
  regenerateError?: string | null;
}

export function AdminUserSecuritySection({
  user,
  revealedTempPassword,
  onRegenerateTempPassword,
  regenerating = false,
  regenerateError = null,
}: AdminUserSecuritySectionProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const tempActive = isAdminTempPasswordActive(
    user.mustChangePassword,
    user.tempPasswordExpiresAt,
  );
  const timeRemaining =
    user.tempPasswordExpiresAt != null
      ? formatAdminTempPasswordTimeRemaining(user.tempPasswordExpiresAt)
      : null;

  const onCopy = useCallback(async () => {
    if (!revealedTempPassword) {
      return;
    }
    await copyTextToClipboard(revealedTempPassword);
    setCopied(true);
  }, [revealedTempPassword]);

  const regenerateLabel = tempActive
    ? 'Regenerate Temporary Password'
    : 'Generate Temporary Password';

  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="lock-outline" size={18} color={FIELD_ORANGE} />
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
          Security
        </Text>
      </View>

      {revealedTempPassword ? (
        <View className="gap-3">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-text-muted">
            Temporary password
          </Text>
          <View className="flex-row items-center gap-3 rounded-control border border-border bg-background px-4 py-3">
            <Text
              className="flex-1 font-sans-semibold text-base tracking-wide text-text"
              selectable
            >
              {revealedTempPassword}
            </Text>
            <Pressable
              onPress={() => void onCopy()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Copied temporary password' : 'Copy temporary password'}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={22}
                color={FIELD_ORANGE}
              />
            </Pressable>
          </View>
          <Text className="font-sans text-sm text-on-surface-variant">
            Shown once in this visit — copy now to relay to the user. It will not appear after you
            leave this profile.
          </Text>
        </View>
      ) : null}

      {!revealedTempPassword && user.mustChangePassword ? (
        <View className="gap-2">
          {tempActive ? (
            <>
              <Text className="font-sans text-base text-text">
                Temporary password active — user must set a new password on next login.
              </Text>
              {timeRemaining ? (
                <Text className="font-sans text-sm text-text-muted">{timeRemaining}</Text>
              ) : null}
            </>
          ) : (
            <Text className="font-sans text-base text-text">
              Temporary password expired — generate a new one for the user to log in.
            </Text>
          )}
        </View>
      ) : null}

      {!revealedTempPassword && !user.mustChangePassword ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          No pending temporary password. Generate one if the user needs admin-assisted first login.
        </Text>
      ) : null}

      {regenerateError ? (
        <Text className="font-sans text-sm text-primary">{regenerateError}</Text>
      ) : null}

      <Button
        label={regenerating ? 'Generating…' : regenerateLabel}
        onPress={onRegenerateTempPassword}
        disabled={regenerating}
        variant="outline"
        className="h-12"
      />
    </Card>
  );
}
