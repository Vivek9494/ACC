import {
  formatTournamentScopeLineTruncated,
  groupTournamentBrowseEntries,
  TOURNAMENT_BROWSE_SECTION_LABELS,
  TOURNAMENT_BROWSE_SECTION_ORDER,
  type TournamentBrowseEntry,
  type TournamentBrowseSectionKey,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildTournamentMenuActions } from '../dashboard/buildTournamentMenuActions';
import { CircularAddButton } from '../ui/CircularAddButton';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, listTournamentBrowseEntries } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { canCreateTournament } from '../../lib/can-create-tournament';
import { tournamentDetailHref, tournamentNewHref } from '../../lib/tournament-detail-route';

function filterTournamentBrowseEntries(
  entries: readonly TournamentBrowseEntry[],
  query: string,
): TournamentBrowseEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...entries];
  }
  return entries.filter(({ tournament }) => {
    if (tournament.name.toLowerCase().includes(normalized)) {
      return true;
    }
    const scopeLine = formatTournamentScopeLineTruncated(tournament.scopeDisplay);
    return scopeLine?.toLowerCase().includes(normalized) ?? false;
  });
}

/** Shared Tournaments tab — all statuses, grouped sections, permission-gated actions. */
export function TournamentsListScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<TournamentBrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(
    () => filterTournamentBrowseEntries(entries, search),
    [entries, search],
  );
  const sections = useMemo(() => groupTournamentBrowseEntries(filteredEntries), [filteredEntries]);
  const visibleSections = useMemo(
    () =>
      TOURNAMENT_BROWSE_SECTION_ORDER.filter(
        (key: TournamentBrowseSectionKey) => sections[key].length > 0,
      ),
    [sections],
  );
  const isEmpty = visibleSections.length === 0;
  const hasSearchQuery = search.trim().length > 0;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listTournamentBrowseEntries()
      .then((list) => {
        if (!cancelled) {
          setEntries(list);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load tournaments.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => load(), [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="z-10 gap-3 bg-background px-4 pb-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-2xl text-on-surface">Tournaments</Text>
          {canCreateTournament(user) ? (
            <CircularAddButton
              accessibilityLabel="Add tournament"
              onPress={() => router.push(tournamentNewHref(user))}
            />
          ) : null}
        </View>
        <TextInput
          placeholder="Search tournaments…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerClassName="mb-0"
        />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-8">
        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} className="py-12" />
        ) : error ? (
          <View className="rounded-xl bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : isEmpty ? (
          <Text className="font-sans text-sm text-on-surface-variant">
            {hasSearchQuery ? 'No tournaments match your search.' : 'No tournaments yet.'}
          </Text>
        ) : (
          visibleSections.map((sectionKey) => (
            <View key={sectionKey} className="gap-3">
              <Text className="font-sans-semibold text-sm uppercase tracking-wider text-on-surface-variant">
                {TOURNAMENT_BROWSE_SECTION_LABELS[sectionKey]}
              </Text>
              {sections[sectionKey].map(({ tournament, permissions, cancelled }) => {
                const menuActions = buildTournamentMenuActions(
                  permissions,
                  tournament.id,
                  tournament.name,
                  router,
                  { onDeleted: load, user },
                );
                return (
                  <TournamentDashboardCard
                    key={tournament.id}
                    tournament={tournament}
                    cancelled={cancelled}
                    onPress={() => user && router.push(tournamentDetailHref(user, tournament.id))}
                    menuActions={menuActions.length > 0 ? menuActions : undefined}
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
