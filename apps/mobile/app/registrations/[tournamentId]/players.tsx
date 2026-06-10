import {
  type AvailabilitySummary,
  RegistrationSortKey,
  type RegistrationSummary,
  type TournamentDetail,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailabilityBar } from '../../../src/components/AvailabilityBar';
import { RatingStats } from '../../../src/components/RatingStats';
import {
  ApiRequestError,
  getAvailabilitySummary,
  getTournament,
  listRegistrations,
  updateRegistrationAvailability,
} from '../../../src/lib/api';

const SORTS: { key: RegistrationSortKey; label: string }[] = [
  { key: RegistrationSortKey.Name, label: 'Name' },
  { key: RegistrationSortKey.Batting, label: 'Bat' },
  { key: RegistrationSortKey.Bowling, label: 'Bowl' },
  { key: RegistrationSortKey.Fielding, label: 'Field' },
  { key: RegistrationSortKey.Availability, label: 'Availability' },
];

export default function RegisteredPlayersScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null);
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [sort, setSort] = useState<RegistrationSortKey>(RegistrationSortKey.Batting);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const t = tournament ?? (await getTournament(tournamentId));
      setTournament(t);
      const isApl = t.type === 'APL';
      const [list, avail] = await Promise.all([
        listRegistrations(tournamentId, { status: 'CONFIRMED', sort }),
        isApl ? getAvailabilitySummary(tournamentId).catch(() => null) : Promise.resolve(null),
      ]);
      setRows(list);
      setSummary(avail);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setAvailability(id: string, isAvailable: boolean): Promise<void> {
    if (!tournamentId) return;
    setBusyId(id);
    try {
      await updateRegistrationAvailability(tournamentId, id, { isAvailable });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update availability.');
    } finally {
      setBusyId(null);
    }
  }

  const isApl = tournament?.type === 'APL';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-2xl text-on-surface">Registered Players</Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          {tournament ? `${tournament.name} · ` : ''}
          {rows.length} confirmed
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-6 py-5 gap-4">
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : (
          <>
            {error ? (
              <View className="rounded-lg bg-error-container px-4 py-3">
                <Text className="font-sans text-sm text-on-error-container">{error}</Text>
              </View>
            ) : null}

            {isApl && summary ? (
              <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <Text className="font-sans-bold text-lg text-primary">Availability</Text>
                <AvailabilityBar summary={summary} />
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
                Sort
              </Text>
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <Button
                    key={s.key}
                    onPress={() => setSort(s.key)}
                    variant={active ? 'primary' : 'outline'}
                    className={`px-3 py-1.5 ${active ? 'border-primary' : 'bg-surface-container-lowest'}`}
                    textClassName={`font-sans text-xs ${active ? 'text-on-primary' : 'text-on-surface'}`}
                    label={s.label}
                  />
                );
              })}
            </View>

            {rows.length === 0 ? (
              <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
                No confirmed players yet.
              </Text>
            ) : (
              rows.map((r) => (
                <View
                  key={r.id}
                  className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {r.firstName} {r.lastName}
                      </Text>
                      <Text className="font-sans text-xs text-on-surface-variant">{r.centerName}</Text>
                    </View>
                    <AvailabilityPill value={r.isAvailable} />
                  </View>

                  <RatingStats
                    batting={r.battingRating}
                    bowling={r.bowlingRating}
                    fielding={r.fieldingRating}
                  />

                  {isApl ? (
                    <View className="flex-row gap-2">
                      <Button
                        disabled={busyId === r.id}
                        onPress={() => void setAvailability(r.id, true)}
                        className="flex-1 bg-secondary-container py-2"
                        textClassName="font-sans-semibold text-sm text-on-secondary-container"
                        label="Available"
                      />
                      <Button
                        disabled={busyId === r.id}
                        onPress={() => void setAvailability(r.id, false)}
                        variant="destructive"
                        className="flex-1 py-2"
                        label="Unavailable"
                      />
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AvailabilityPill({ value }: { value: boolean | null }): React.ReactElement {
  const label = value === true ? 'In' : value === false ? 'Out' : 'Pending';
  const style =
    value === true
      ? 'bg-secondary-container'
      : value === false
        ? 'bg-error-container'
        : 'bg-surface-container-high';
  return (
    <View className={`rounded-full px-3 py-1 ${style}`}>
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface">{label}</Text>
    </View>
  );
}
