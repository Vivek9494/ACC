import { Ionicons } from '@expo/vector-icons';
import { RegistrationStatus, type RegistrationSummary } from '@acc/types';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';
import { PlayerAvatarWithStatus } from './PlayerAvatarWithStatus';
import { VerifyPlayerRatingsRow } from './VerifyPlayerRatingsRow';
import { VerifyPlayerVerificationBadge } from './VerifyPlayerVerificationBadge';

export interface VerifyPlayerCardProps {
  row: RegistrationSummary;
  canManage: boolean;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onEdit: () => void;
}

export function VerifyPlayerCard({
  row,
  canManage,
  busy,
  onApprove,
  onDecline,
  onEdit,
}: VerifyPlayerCardProps): React.ReactElement {
  const isDeclined = row.status === RegistrationStatus.Declined;
  const isPending = row.status === RegistrationStatus.InWaitlist;
  const canApprove = canManage && isPending;
  const canDecline = canManage && isPending;
  const showVerificationBadge = canManage && !isDeclined;
  const showActions = canManage && !isDeclined;

  return (
    <View
      className={`rounded-lg border px-4 py-3 ${
        isDeclined
          ? 'border-secondary-700/30 bg-surface-container-high opacity-90'
          : 'border-outline-variant bg-surface'
      }`}
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-start gap-3">
        <PlayerAvatarWithStatus
          firstName={row.firstName}
          profilePhotoUrl={row.profilePhotoUrl}
          status={canManage ? null : row.status}
        />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text
              className={`min-w-0 flex-1 font-sans-bold text-base ${
                isDeclined ? 'text-on-surface-variant' : 'text-on-surface'
              }`}
              numberOfLines={1}
            >
              {row.firstName} {row.lastName}
            </Text>
            {showVerificationBadge ? (
              <View className="shrink-0">
                <VerifyPlayerVerificationBadge status={row.status} />
              </View>
            ) : null}
          </View>
          <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {row.mobileNumber}
          </Text>
          {isDeclined ? (
            <Text className="font-sans-medium text-xs text-secondary-900">Declined</Text>
          ) : null}
          <View className="mt-2 flex-row items-center gap-2">
            <VerifyPlayerRatingsRow
              batting={row.battingRating}
              bowling={row.bowlingRating}
              fielding={row.fieldingRating}
            />
            {showActions ? (
              <View className="shrink-0 flex-row items-center gap-1.5">
                {canApprove ? (
                  <Pressable
                    onPress={onApprove}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Approve player"
                    className="h-9 w-9 items-center justify-center rounded-full bg-primary-container shadow-md active:scale-90"
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.textInverse} size="small" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                    )}
                  </Pressable>
                ) : null}
                {canDecline ? (
                  <Pressable
                    onPress={onDecline}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Decline player"
                    className="h-9 w-9 items-center justify-center rounded-full border border-secondary-700/40 bg-surface-container-high active:scale-90"
                  >
                    <Ionicons name="close" size={20} color={colors.secondaryDark} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onEdit}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Edit ratings"
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:scale-90"
                >
                  <Ionicons name="pencil" size={16} color={FIELD_ORANGE} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
