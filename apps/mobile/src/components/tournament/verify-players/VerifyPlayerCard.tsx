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
  onRevert?: () => void;
}

export function VerifyPlayerCard({
  row,
  canManage,
  busy,
  onApprove,
  onDecline,
  onEdit,
  onRevert,
}: VerifyPlayerCardProps): React.ReactElement {
  const isDeclined = row.status === RegistrationStatus.Declined;
  const isPending = row.status === RegistrationStatus.InWaitlist;
  const canApprove = canManage && isPending;
  const canDecline = canManage && isPending;
  const canRevert = canManage && isDeclined && onRevert != null;

  return (
    <View
      className="rounded-lg border border-outline-variant bg-surface px-4 py-3"
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
              className="min-w-0 flex-1 font-sans-bold text-base text-on-surface"
              numberOfLines={1}
            >
              {row.firstName} {row.lastName}
            </Text>
            {canManage ? (
              <View className="shrink-0">
                <VerifyPlayerVerificationBadge status={row.status} />
              </View>
            ) : null}
          </View>
          <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {row.mobileNumber}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="min-w-0 flex-1">
              <VerifyPlayerRatingsRow
                batting={row.battingRating}
                bowling={row.bowlingRating}
                fielding={row.fieldingRating}
              />
            </View>
            {canManage ? (
              <View className="shrink-0 flex-row items-center gap-1.5">
                {canApprove ? (
                  <Pressable
                    onPress={onApprove}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Approve player"
                    className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:scale-90"
                  >
                    {busy ? (
                      <ActivityIndicator color={FIELD_ORANGE} size="small" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color={FIELD_ORANGE} />
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
                {canRevert ? (
                  <Pressable
                    onPress={onRevert}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Move back to pending"
                    className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:scale-90"
                  >
                    {busy ? (
                      <ActivityIndicator color={FIELD_ORANGE} size="small" />
                    ) : (
                      <Ionicons name="arrow-undo" size={18} color={FIELD_ORANGE} />
                    )}
                  </Pressable>
                ) : null}
                {!isDeclined ? (
                  <Pressable
                    onPress={onEdit}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Edit ratings"
                    className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:scale-90"
                  >
                    <Ionicons name="pencil" size={16} color={FIELD_ORANGE} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
