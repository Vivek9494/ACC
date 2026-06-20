import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { ManOfMatchCandidate } from '../../lib/match-completion';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface ManOfMatchDialogProps {
  visible: boolean;
  teamName: string;
  resultLine: string | null;
  candidates: readonly ManOfMatchCandidate[];
  /** When true, selection is mandatory and the dialog cannot be dismissed without confirming. */
  required?: boolean;
  dueAt?: string | null;
  overdue?: boolean;
  onDismiss?: () => void;
  onConfirm: (userId: string) => void;
}

function CandidateRow({
  candidate,
  selected,
  onPress,
}: {
  candidate: ManOfMatchCandidate;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const figureParts = [candidate.battingLine, candidate.bowlingLine].filter(Boolean);
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
          {figureParts.length > 0 ? (
            <Text className="font-sans text-sm text-on-surface-variant">
              {figureParts.join(' · ')}
            </Text>
          ) : (
            <Text className="font-sans text-sm text-on-surface-variant">No figures</Text>
          )}
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
      </View>
    </Pressable>
  );
}

function dueLabel(dueAt: string | null | undefined, overdue: boolean | undefined): string | null {
  if (!dueAt) return null;
  const day = dueAt.slice(0, 10);
  if (overdue) {
    return `Overdue — required by end of match day (${day})`;
  }
  return `Required by end of match day (${day})`;
}

/** Post-match MoM picker for the winning team's registered players (§13.3). */
export function ManOfMatchDialog({
  visible,
  teamName,
  resultLine,
  candidates,
  required = true,
  dueAt,
  overdue,
  onDismiss,
  onConfirm,
}: ManOfMatchDialogProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deadlineLine = dueLabel(dueAt, overdue);

  useEffect(() => {
    if (visible) {
      setSelectedId(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={required ? undefined : onDismiss}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-4"
        onPress={required ? undefined : onDismiss}
      >
        <Pressable
          className="max-h-[85%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Man of the Match</Text>
            {required ? (
              <Text className="mt-1 font-sans-semibold text-sm text-primary">Required</Text>
            ) : null}
            {deadlineLine ? (
              <Text
                className={`mt-1 font-sans text-sm ${
                  overdue ? 'text-secondary-900' : 'text-on-surface-variant'
                }`}
              >
                {deadlineLine}
              </Text>
            ) : null}
            {resultLine ? (
              <Text className="mt-1 font-sans text-sm text-on-surface-variant">{resultLine}</Text>
            ) : null}
            <Text className="mt-1 font-sans text-sm text-on-surface">
              Select from {teamName}
            </Text>
          </View>
          <View className="gap-2 p-4">
            {candidates.map((candidate) => (
              <CandidateRow
                key={candidate.userId}
                candidate={candidate}
                selected={selectedId === candidate.userId}
                onPress={() => setSelectedId(candidate.userId)}
              />
            ))}
            <Button
              label="Confirm Man of the Match"
              disabled={selectedId == null}
              onPress={() => {
                if (selectedId) onConfirm(selectedId);
              }}
              className="mt-1 h-11"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
