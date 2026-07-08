import {
  formatTournamentScopeLineTruncated,
  groupTournamentBrowseEntries,
  TOURNAMENT_BROWSE_SECTION_LABELS,
  TOURNAMENT_BROWSE_SECTION_ORDER,
  type TournamentBrowseEntry,
  type TournamentBrowseSectionKey,
  type TournamentSummary,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { ApiRequestError, listPublicTournaments } from '../../lib/api';

const EMPTY_PERMISSIONS = {
  canEdit: false,
  canDelete: false,
  canManageCenterPlayers: false,
} as const;

function toBrowseEntries(tournaments: TournamentSummary[]): TournamentBrowseEntry[] {
  return tournaments.map((tournament) => ({
    tournament,
    cancelled: false,
    permissions: EMPTY_PERMISSIONS,
  }));
}

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

/** Guest Tournaments tab — public list, search, grouped sections. */
export function GuestTournamentsListScreen(): React.ReactElement {
  const router = useRouter();
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
    listPublicTournaments()
      .then((list) => {
        if (!cancelled) {
          setEntries(toBrowseEntries(list));
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
    <>
      <View className="z-10 gap-3 bg-background px-4 pb-4 pt-4">
        <Text className="font-sans-bold text-2xl text-on-surface">Tournaments</Text>
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
              {sections[sectionKey].map(({ tournament }) => (
                <TournamentDashboardCard
                  key={tournament.id}
                  tournament={tournament}
                  onPress={() => router.push(`/tournaments/${tournament.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}
