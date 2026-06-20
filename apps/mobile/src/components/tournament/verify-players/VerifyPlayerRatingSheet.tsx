import {
  BallType,
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  REGISTRATION_RATING_OPTIONS,
  type RegistrationDetail,
  type RegistrationSummary,
  RegistrationPlayerType,
} from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ApiRequestError, updateRegistrationRatings } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';
import { RadioGroup } from '../../ui/RadioGroup';
import { Select, type SelectOption } from '../../ui/Select';
import { Text } from '../../ui/Text';

function ratingOptions(
  options: readonly { value: number; label: string }[],
): SelectOption[] {
  return options.map((option) => ({ value: String(option.value), label: option.label }));
}

const BATTING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);
const BOWLING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);
const FIELDING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);

export interface VerifyPlayerRatingSheetProps {
  visible: boolean;
  row: RegistrationSummary | null;
  tournamentId: string;
  isLeatherBall: boolean;
  onClose: () => void;
  onSaved: (updated: RegistrationDetail) => void;
}

/** Centered modal to edit BAT/BOWL/FIELD ratings after the registration window closes (§7.5). */
export function VerifyPlayerRatingSheet({
  visible,
  row,
  tournamentId,
  isLeatherBall,
  onClose,
  onSaved,
}: VerifyPlayerRatingSheetProps): React.ReactElement {
  const [battingRating, setBattingRating] = useState<string | null>(null);
  const [bowlingRating, setBowlingRating] = useState<string | null>(null);
  const [fieldingRating, setFieldingRating] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<RegistrationPlayerType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) {
      return;
    }
    setBattingRating(row.battingRating === null ? null : String(row.battingRating));
    setBowlingRating(row.bowlingRating === null ? null : String(row.bowlingRating));
    setFieldingRating(row.fieldingRating === null ? null : String(row.fieldingRating));
    setPlayerType(row.playerType);
    setError(null);
  }, [row]);

  async function submit(): Promise<void> {
    if (!row) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateRegistrationRatings(tournamentId, row.id, {
        battingRating: battingRating === null ? null : Number(battingRating),
        bowlingRating: bowlingRating === null ? null : Number(bowlingRating),
        fieldingRating: fieldingRating === null ? null : Number(fieldingRating),
        playerType: isLeatherBall ? playerType : null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save ratings.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-6" onPress={onClose}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-surface p-5"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          {row ? (
            <View className="gap-1">
              <Text className="font-sans-bold text-lg text-on-surface">
                {row.firstName} {row.lastName}
              </Text>
              <Text className="font-sans text-sm text-on-surface-variant">{row.mobileNumber}</Text>
            </View>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="gap-3">
              <Select
                label="Batting Rating"
                value={battingRating}
                options={BATTING_OPTIONS}
                onChange={setBattingRating}
              />
              <Select
                label="Bowling Rating"
                value={bowlingRating}
                options={BOWLING_OPTIONS}
                onChange={setBowlingRating}
              />
              <Select
                label="Fielding Rating"
                value={fieldingRating}
                options={FIELDING_OPTIONS}
                onChange={setFieldingRating}
              />
              {isLeatherBall ? (
                <RadioGroup
                  label="Player Type"
                  value={playerType}
                  onChange={setPlayerType}
                  options={REGISTRATION_PLAYER_TYPE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              ) : null}
            </View>
          </ScrollView>

          {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

          <View className="gap-3">
            <Button
              label={submitting ? 'Submitting…' : 'Submit'}
              onPress={() => void submit()}
              disabled={submitting}
              className="h-12 w-full"
            />
            <Button
              variant="outline"
              label="Cancel"
              onPress={onClose}
              disabled={submitting}
              className="h-12 w-full border-primary"
              textClassName="text-primary"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
