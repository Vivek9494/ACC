import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import type { ManOfMatchCandidate } from '../../lib/match-completion';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

export interface ManOfMatchCandidateRowProps {
  candidate: ManOfMatchCandidate;
  selected: boolean;
  onPress: () => void;
}

function LabeledFigureLine({
  label,
  value,
}: {
  label: 'Batting' | 'Bowling';
  value: string;
}): React.ReactElement {
  return (
    <Text className="font-sans text-sm leading-5">
      <Text className="font-sans-semibold text-on-surface">{label}: </Text>
      <Text className="text-on-surface-variant">{value}</Text>
    </Text>
  );
}

export function ManOfMatchCandidateRow({
  candidate,
  selected,
  onPress,
}: ManOfMatchCandidateRowProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-control border px-3 py-3 active:opacity-80 ${
        selected ? 'border-2 border-primary bg-primary-container' : 'border-outline-variant bg-surface'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-sans-semibold text-base text-on-surface">
            {candidate.firstName} {candidate.lastName}
          </Text>
          {candidate.battingLine ? (
            <LabeledFigureLine label="Batting" value={candidate.battingLine} />
          ) : null}
          {candidate.bowlingLine ? (
            <LabeledFigureLine label="Bowling" value={candidate.bowlingLine} />
          ) : null}
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
      </View>
    </Pressable>
  );
}
