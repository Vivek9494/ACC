import {
  BallType,
  isTournamentRegistrationWindowClosed,
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  REGISTRATION_RATING_OPTIONS,
  RegistrationPlayerType,
  type RegistrationSummary,
  type TournamentDetail,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../../src/components/ui/fieldStyles';
import { RadioGroup } from '../../../src/components/ui/RadioGroup';
import { Select, type SelectOption } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import {
  ApiRequestError,
  getTournament,
  listRegistrations,
  updateRegistrationRatings,
} from '../../../src/lib/api';

function ratingOptions(
  options: readonly { value: number; label: string }[],
): SelectOption[] {
  return options.map((option) => ({ value: String(option.value), label: option.label }));
}

const BATTING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);
const BOWLING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);
const FIELDING_OPTIONS = ratingOptions(REGISTRATION_RATING_OPTIONS);

function RatingsReviewRow({
  row,
  tournamentId,
  isLeatherBall,
  onSaved,
}: {
  row: RegistrationSummary;
  tournamentId: string;
  isLeatherBall: boolean;
  onSaved: () => void;
}): React.ReactElement {
  const [battingRating, setBattingRating] = useState<string | null>(
    row.battingRating === null ? null : String(row.battingRating),
  );
  const [bowlingRating, setBowlingRating] = useState<string | null>(
    row.bowlingRating === null ? null : String(row.bowlingRating),
  );
  const [fieldingRating, setFieldingRating] = useState<string | null>(
    row.fieldingRating === null ? null : String(row.fieldingRating),
  );
  const [playerType, setPlayerType] = useState<RegistrationPlayerType | null>(row.playerType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await updateRegistrationRatings(tournamentId, row.id, {
        battingRating: battingRating === null ? null : Number(battingRating),
        bowlingRating: bowlingRating === null ? null : Number(bowlingRating),
        fieldingRating: fieldingRating === null ? null : Number(fieldingRating),
        playerType: isLeatherBall ? playerType : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save ratings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      className="gap-4 rounded-control border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <View>
        <Text className="font-sans-bold text-base text-on-surface">
          {row.firstName} {row.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">{row.centerName}</Text>
      </View>

      <View className="gap-3">
        <Select
          label="Batting rating"
          value={battingRating}
          options={BATTING_OPTIONS}
          onChange={setBattingRating}
        />
        <Select
          label="Bowling rating"
          value={bowlingRating}
          options={BOWLING_OPTIONS}
          onChange={setBowlingRating}
        />
        <Select
          label="Fielding rating"
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

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}

      <Button
        label={saving ? 'Saving…' : 'Save ratings'}
        onPress={() => void save()}
        disabled={saving}
        className="h-11 w-full"
      />
    </View>
  );
}

export default function RegistrationRatingsReviewScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const [tournamentDetail, registrations] = await Promise.all([
        getTournament(tournamentId),
        listRegistrations(tournamentId),
      ]);
      setTournament(tournamentDetail);
      setRows(registrations);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load registrations.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const windowClosed = tournament ? isTournamentRegistrationWindowClosed(tournament) : false;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 px-4 py-4">
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <View className="gap-1">
          <Text className="font-sans-bold text-2xl text-on-surface">Adjust player ratings</Text>
          {tournament ? (
            <Text className="font-sans text-sm text-on-surface-variant">{tournament.name}</Text>
          ) : null}
        </View>

        {!windowClosed ? (
          <View className="rounded-control bg-surface-container-high px-4 py-3">
            <Text className="font-sans text-sm text-on-surface-variant">
              Ratings can be adjusted only after the registration window closes.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="rounded-control bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {windowClosed
          ? rows.map((row) => (
              <RatingsReviewRow
                key={row.id}
                row={row}
                tournamentId={tournamentId ?? ''}
                isLeatherBall={tournament?.ballType === BallType.Leather}
                onSaved={() => void load()}
              />
            ))
          : null}

        {windowClosed && rows.length === 0 ? (
          <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
            No registrations yet for this tournament.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
