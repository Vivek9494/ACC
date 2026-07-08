import { formatFeeAmountCents, type TournamentFeeEntry } from '@acc/types';
import { Image, View } from 'react-native';

import { Button } from '../../ui/Button';
import { INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';

function PlayerAvatar({
  firstName,
  profilePhotoUrl,
}: {
  firstName: string;
  profilePhotoUrl: string | null;
}): React.ReactElement {
  const initial = firstName.slice(0, 1).toUpperCase();
  return profilePhotoUrl ? (
    <Image source={{ uri: profilePhotoUrl }} className="h-16 w-16 rounded-full border-2 border-surface-container" />
  ) : (
    <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-surface-container bg-surface-container-high">
      <Text className="font-sans-bold text-xl text-primary">{initial}</Text>
    </View>
  );
}

export interface FeePaidPlayerCardProps {
  entry: TournamentFeeEntry;
}

export function FeePaidPlayerCard({ entry }: FeePaidPlayerCardProps): React.ReactElement {
  return (
    <View
      className="flex-row items-center gap-4 rounded-xl border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <PlayerAvatar firstName={entry.firstName} profilePhotoUrl={entry.profilePhotoUrl} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
          {entry.firstName} {entry.lastName}
        </Text>
        {entry.cardSubtitle ? (
          <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {entry.cardSubtitle}
          </Text>
        ) : null}
      </View>
      <View className="rounded-full bg-secondary px-3 py-1">
        <Text className="font-sans-semibold text-xs text-text-inverse">Paid</Text>
      </View>
    </View>
  );
}

export interface FeeUnpaidPlayerCardProps {
  entry: TournamentFeeEntry;
  busy: boolean;
  onPay: () => void;
}

export function FeeUnpaidPlayerCard({
  entry,
  busy,
  onPay,
}: FeeUnpaidPlayerCardProps): React.ReactElement {
  return (
    <View
      className="flex-row items-center gap-4 rounded-xl border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <PlayerAvatar firstName={entry.firstName} profilePhotoUrl={entry.profilePhotoUrl} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
          {entry.firstName} {entry.lastName}
        </Text>
        {entry.cardSubtitle ? (
          <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {entry.cardSubtitle}
          </Text>
        ) : null}
        <Text className="mt-1 font-sans-semibold text-sm text-primary">
          {formatFeeAmountCents(entry.amountCents)}
        </Text>
      </View>
      <Button
        label={busy ? 'Saving…' : 'Pay'}
        disabled={busy}
        onPress={onPay}
        className="h-10 bg-secondary-container px-4"
        textClassName="font-sans-semibold text-sm text-on-secondary-container"
      />
    </View>
  );
}
