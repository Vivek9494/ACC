import {
  REGISTRATION_STATUS_LABELS,
  type RegistrationStatus,
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

import { RatingStats } from '../../../src/components/RatingStats';
import {
  ApiRequestError,
  approveRegistration,
  declineRegistration,
  getTournament,
  listRegistrations,
} from '../../../src/lib/api';

const FILTERS: { key: RegistrationStatus | 'ALL'; label: string }[] = [
  { key: 'IN_WAITLIST', label: 'In Waitlist' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'ALL', label: 'All' },
];

export default function VerifyPlayersScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [filter, setFilter] = useState<RegistrationStatus | 'ALL'>('IN_WAITLIST');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const [t, list] = await Promise.all([
        tournament ? Promise.resolve(tournament) : getTournament(tournamentId),
        listRegistrations(tournamentId, filter === 'ALL' ? {} : { status: filter }),
      ]);
      setTournament(t);
      setRows(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    id: string,
    action: (t: string, r: string) => Promise<unknown>,
  ): Promise<void> {
    if (!tournamentId) return;
    setBusyId(id);
    try {
      await action(tournamentId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-2xl text-on-surface">Verify Players</Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          {tournament ? `${tournament.name} · ` : ''}Total {rows.length}
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Button
                key={f.key}
                onPress={() => setFilter(f.key)}
                variant={active ? 'primary' : 'outline'}
                className={`px-4 py-2 ${active ? 'border-primary' : 'bg-surface-container-lowest'}`}
                textClassName={`font-sans text-sm ${active ? 'text-on-primary' : 'text-on-surface'}`}
                label={f.label}
              />
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerClassName="px-6 py-5 gap-3">
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : rows.length === 0 ? (
          <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
            No players in this list.
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
                  <Text className="font-sans text-sm text-on-surface-variant">{r.mobileNumber}</Text>
                  <Text className="font-sans text-xs text-on-surface-variant">{r.centerName}</Text>
                </View>
                <View className="rounded-full bg-surface-container-high px-3 py-1">
                  <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {REGISTRATION_STATUS_LABELS[r.status]}
                  </Text>
                </View>
              </View>

              <RatingStats batting={r.battingRating} bowling={r.bowlingRating} fielding={r.fieldingRating} />

              <View className="flex-row gap-2">
                {r.status !== 'CONFIRMED' ? (
                  <Button
                    disabled={busyId === r.id}
                    onPress={() => void act(r.id, approveRegistration)}
                    className="flex-1 py-3"
                    label="Approve"
                  />
                ) : null}
                {r.status !== 'DECLINED' ? (
                  <Button
                    disabled={busyId === r.id}
                    onPress={() => void act(r.id, declineRegistration)}
                    variant="destructive"
                    className="flex-1 py-3"
                    label="Decline"
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
