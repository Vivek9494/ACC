import {
  managerRoleAllowed,
  type MatchSummary,
  TOURNAMENT_FORMAT_LABELS,
  TOURNAMENT_STATE_LABELS,
  TOURNAMENT_STATE_TRANSITIONS,
  type TournamentDetail,
  type TournamentState,
  UserRole,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Text } from '../../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchStateBadge } from '../../src/components/MatchStateBadge';
import { StateBadge } from '../../src/components/StateBadge';
import {
  ApiRequestError,
  getTournament,
  listMatches,
  transitionTournamentState,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';

const TABS = ['Details', 'Matches', 'Teams', 'Points Table'] as const;
type Tab = (typeof TABS)[number];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text className="font-sans text-sm text-on-surface-variant">{label}</Text>
      <Text className="flex-1 text-right font-sans-semibold text-sm text-on-surface">{value}</Text>
    </View>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <Text className="mb-1 font-sans-bold text-lg text-primary">{title}</Text>
      {children}
    </View>
  );
}

export default function TournamentDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Details');
  const [working, setWorking] = useState(false);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);

  const canManage = user?.role === UserRole.Admin || user?.role === UserRole.ClubManager;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setTournament(await getTournament(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMatches = useCallback(async () => {
    if (!id) return;
    try {
      setMatches(await listMatches(id));
    } catch {
      // The Matches tab simply shows an empty state on failure.
    } finally {
      setMatchesLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'Matches' && !matchesLoaded) {
      void loadMatches();
    }
  }, [tab, matchesLoaded, loadMatches]);

  // Refresh fixtures when returning from match creation / setup.
  useFocusEffect(
    useCallback(() => {
      if (tab === 'Matches') {
        void loadMatches();
      }
    }, [tab, loadMatches]),
  );

  async function advance(next: TournamentState): Promise<void> {
    if (!id) return;
    setWorking(true);
    try {
      setTournament(await transitionTournamentState(id, next));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not change state.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#a04100" />
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="px-6 py-12">
          <Pressable onPress={() => router.back()}>
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          <Text className="mt-6 font-sans text-base text-on-surface-variant">
            {error ?? 'Tournament not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const nextStates = TOURNAMENT_STATE_TRANSITIONS[tournament.state];
  const isLeather = tournament.ballType === 'LEATHER';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="pb-12">
        <View className="px-6 pt-4">
          <Pressable onPress={() => router.back()} className="mb-3">
            <Text className="font-sans text-primary">← Back</Text>
          </Pressable>
          {tournament.posterUrl ? (
            <Image
              source={{ uri: tournament.posterUrl }}
              className="h-44 w-full rounded-2xl"
              resizeMode="cover"
            />
          ) : (
            <View className="h-44 w-full items-center justify-center rounded-2xl bg-surface-container-high">
              <Text className="font-sans-bold text-4xl text-on-surface-variant">
                {tournament.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="font-sans-bold text-2xl text-on-surface">{tournament.name}</Text>
              <Text className="font-sans text-sm text-on-surface-variant">
                {formatDate(tournament.startAt)} – {formatDate(tournament.endAt)}
              </Text>
            </View>
            <View
              className={`h-6 w-6 rounded-full ${isLeather ? 'bg-[#c1121f]' : 'bg-secondary-container'}`}
            />
          </View>

          <View className="mt-3 flex-row items-center gap-2">
            <StateBadge state={tournament.state} />
            <View className="rounded-full bg-surface-container-high px-3 py-1">
              <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
                {tournament.type}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="mt-5 flex-row border-b border-outline-variant px-6">
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className="mr-5 pb-3">
              <Text
                className={`font-sans-semibold text-sm ${
                  tab === t ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {t}
              </Text>
              {tab === t ? <View className="mt-2 h-0.5 rounded-full bg-primary" /> : null}
            </Pressable>
          ))}
        </View>

        <View className="gap-4 px-6 pt-5">
          {tab === 'Details' ? (
            <>
              <Card title="Registration Details">
                <InfoRow
                  label="Open Date & Time"
                  value={formatDateTime(tournament.registrationOpenAt)}
                />
                <InfoRow
                  label="Close Date & Time"
                  value={formatDateTime(tournament.registrationCloseAt)}
                />
                <Button
                  onPress={() => router.push(`/registrations/${tournament.id}`)}
                  className="mt-3 h-12"
                  label="My Registration"
                />
              </Card>

              {/* §7.3–§7.5: Center Sevak / organizer registration tools. */}
              <Card title="Organizer Tools">
                <Text className="mb-3 font-sans text-sm text-on-surface-variant">
                  Approve players and manage ratings & availability for your Center.
                </Text>
                <View className="gap-2">
                  <Button
                    onPress={() => router.push(`/registrations/${tournament.id}/queue`)}
                    variant="outline"
                    className="h-12 border-primary"
                    textClassName="text-primary"
                    label="Verify Players"
                  />
                  <Button
                    onPress={() => router.push(`/registrations/${tournament.id}/players`)}
                    variant="outline"
                    className="h-12 border-primary"
                    textClassName="text-primary"
                    label={`Registered Players${tournament.type === 'APL' ? ' & Availability' : ''}`}
                  />
                </View>
              </Card>

              <Card title="Tournament Schedule">
                <InfoRow label="Start Date" value={formatDate(tournament.startAt)} />
                <InfoRow label="End Date" value={formatDate(tournament.endAt)} />
                {tournament.videoRequired ? (
                  <InfoRow
                    label="Video Upload End"
                    value={formatDate(tournament.videoUploadEndDate)}
                  />
                ) : null}
              </Card>

              <Card title="Format & Rules">
                <InfoRow label="Format" value={TOURNAMENT_FORMAT_LABELS[tournament.format]} />
                <InfoRow label="Overs / innings" value={String(tournament.oversPerInnings)} />
                <InfoRow label="Max overs / bowler" value={String(tournament.maxOversPerBowler)} />
                <InfoRow label="Ball" value={isLeather ? 'Leather' : 'Tennis'} />
                <InfoRow
                  label="Impact Player"
                  value={tournament.impactPlayerEnabled ? 'Enabled' : 'Off'}
                />
                <InfoRow
                  label="Video Required"
                  value={tournament.videoRequired ? 'Yes' : 'No'}
                />
              </Card>

              <Card title="Team Roles">
                {/* Manager does not exist in ACC (§2, D1). */}
                <Text className="font-sans text-sm text-on-surface-variant">
                  Captain, Vice Captain{managerRoleAllowed(tournament.type) ? ', Manager' : ''}
                </Text>
                {!managerRoleAllowed(tournament.type) ? (
                  <Text className="mt-1 font-sans text-xs text-on-surface-variant">
                    ACC teams have no Manager role.
                  </Text>
                ) : null}
              </Card>

              <Card title="Venue">
                <Text className="font-sans text-base text-on-surface">
                  {tournament.location ?? 'To be announced'}
                </Text>
              </Card>

              {canManage && nextStates.length > 0 ? (
                <View className="gap-2">
                  <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
                    Advance state
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {nextStates.map((next) => (
                      <Button
                        key={next}
                        disabled={working}
                        onPress={() => void advance(next)}
                        variant="outline"
                        className="border-primary px-4 py-2"
                        textClassName="text-primary"
                        label={TOURNAMENT_STATE_LABELS[next]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : tab === 'Matches' ? (
            <>
              {canManage ? (
                <Button
                  onPress={() => router.push(`/matches/new?tournamentId=${tournament.id}`)}
                  className="h-12"
                  label="+ New Match"
                />
              ) : null}
              {matches.length === 0 ? (
                <Text className="py-10 text-center font-sans text-base text-on-surface-variant">
                  No matches scheduled yet.
                </Text>
              ) : (
                matches.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push(`/matches/${m.id}`)}
                    className="gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="flex-1 font-sans-semibold text-base text-on-surface">
                        {m.homeTeamName ?? 'TBD'} vs{' '}
                        {m.awayTeamName ?? m.externalOpponentName ?? 'TBD'}
                      </Text>
                      <MatchStateBadge state={m.state} />
                    </View>
                    {m.matchCode ? (
                      <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
                        {m.matchCode}
                      </Text>
                    ) : null}
                    {m.matchDate ? (
                      <Text className="font-sans text-sm text-on-surface-variant">
                        {formatDateTime(m.matchDate)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </>
          ) : tab === 'Teams' ? (
            tournament.teams.length === 0 ? (
              <Text className="py-10 text-center font-sans text-base text-on-surface-variant">
                No teams yet.
              </Text>
            ) : (
              tournament.teams.map((team) => (
                <View
                  key={team.id}
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3"
                >
                  <Text className="font-sans-semibold text-base text-on-surface">{team.name}</Text>
                </View>
              ))
            )
          ) : (
            <Text className="py-10 text-center font-sans text-base text-on-surface-variant">
              No records found in {tab}.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
