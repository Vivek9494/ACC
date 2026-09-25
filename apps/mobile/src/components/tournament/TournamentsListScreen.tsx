import {
  BallType,
  formatTournamentScopeLineTruncated,
  groupTournamentBrowseEntries,
  TOURNAMENT_BROWSE_SECTION_LABELS,
  TOURNAMENT_BROWSE_SECTION_ORDER,
  type BallType as BallTypeValue,
  type CenterSummary,
  type ProvinceSummary,
  type TournamentBrowseEntry,
  type TournamentBrowseSectionKey,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { buildTournamentMenuActions } from '../dashboard/buildTournamentMenuActions';
import { Button } from '../ui/Button';
import { CircularAddButton } from '../ui/CircularAddButton';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import {
  ApiRequestError,
  getCenters,
  getProvinces,
  listTournamentBrowseEntries,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { canCreateTournament } from '../../lib/can-create-tournament';
import { tournamentDetailHref, tournamentNewHref } from '../../lib/tournament-detail-route';

const ALL_FILTER_VALUE = '__all__';

const BALL_TYPE_OPTIONS: SelectOption[] = [
  { value: ALL_FILTER_VALUE, label: 'All ball types' },
  { value: BallType.Tennis, label: 'Tennis Ball' },
  { value: BallType.Leather, label: 'Leather Ball' },
];

interface TournamentListFilters {
  provinceId: string | null;
  centerId: string | null;
  year: number | null;
  ballType: BallTypeValue | null;
}

const EMPTY_FILTERS: TournamentListFilters = {
  provinceId: null,
  centerId: null,
  year: null,
  ballType: null,
};

function filterHasValues(filters: TournamentListFilters): boolean {
  return (
    filters.provinceId != null ||
    filters.centerId != null ||
    filters.year != null ||
    filters.ballType != null
  );
}

function filterTournamentBrowseEntries(
  entries: readonly TournamentBrowseEntry[],
  query: string,
  filters: TournamentListFilters,
): TournamentBrowseEntry[] {
  const normalized = query.trim().toLowerCase();
  return entries.filter(({ tournament }) => {
    if (filters.provinceId != null && tournament.provinceId !== filters.provinceId) {
      return false;
    }
    if (
      filters.centerId != null &&
      !(tournament.scopeDisplay.centerIds ?? []).includes(filters.centerId)
    ) {
      return false;
    }
    if (filters.year != null && tournament.year !== filters.year) {
      return false;
    }
    if (filters.ballType != null && tournament.ballType !== filters.ballType) {
      return false;
    }
    if (!normalized) {
      return true;
    }
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TournamentListFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<TournamentListFilters>(EMPTY_FILTERS);
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const filteredEntries = useMemo(
    () => filterTournamentBrowseEntries(entries, search, appliedFilters),
    [appliedFilters, entries, search],
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
  const hasAppliedFilters = filterHasValues(appliedFilters);

  const provinceOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL_FILTER_VALUE, label: 'All provinces' },
      ...provinces.map((province) => ({ value: province.id, label: province.name })),
    ],
    [provinces],
  );

  const centerOptions = useMemo<SelectOption[]>(() => {
    if (!draftFilters.provinceId) {
      return [{ value: ALL_FILTER_VALUE, label: 'All centers' }];
    }
    const provinceCenters = centers.filter(
      (center) => center.provinceId === draftFilters.provinceId,
    );
    return [
      { value: ALL_FILTER_VALUE, label: 'All centers' },
      ...provinceCenters.map((center) => ({ value: center.id, label: center.name })),
    ];
  }, [centers, draftFilters.provinceId]);

  const yearOptions = useMemo<SelectOption[]>(() => {
    const years = [...new Set(entries.map((entry) => entry.tournament.year))].sort(
      (a, b) => b - a,
    );
    return [
      { value: ALL_FILTER_VALUE, label: 'All years' },
      ...years.map((year) => ({ value: String(year), label: String(year) })),
    ];
  }, [entries]);

  const loadGeography = useCallback(async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const [provinceRows, centerRows] = await Promise.all([getProvinces(), getCenters()]);
      setProvinces(provinceRows);
      setCenters(centerRows);
    } catch (err: unknown) {
      console.error('Failed to load tournament filter geography', err);
      setGeoError("Couldn't load provinces and centers.");
      setProvinces([]);
      setCenters([]);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGeography();
  }, [loadGeography]);

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

  function toggleFiltersPanel(): void {
    setFiltersOpen((open) => {
      const next = !open;
      if (next) {
        setDraftFilters(appliedFilters);
      }
      return next;
    });
  }

  function handleDraftProvinceChange(value: string): void {
    const nextProvinceId = value === ALL_FILTER_VALUE ? null : value;
    setDraftFilters((current) => {
      const nextCenterId =
        nextProvinceId && current.centerId
          ? centers.find((center) => center.id === current.centerId)?.provinceId === nextProvinceId
            ? current.centerId
            : null
          : null;
      return {
        ...current,
        provinceId: nextProvinceId,
        centerId: nextProvinceId ? nextCenterId : null,
      };
    });
  }

  function handleDraftCenterChange(value: string): void {
    setDraftFilters((current) => ({
      ...current,
      centerId: value === ALL_FILTER_VALUE ? null : value,
    }));
  }

  function handleDraftYearChange(value: string): void {
    setDraftFilters((current) => ({
      ...current,
      year: value === ALL_FILTER_VALUE ? null : Number(value),
    }));
  }

  function handleDraftBallTypeChange(value: string): void {
    setDraftFilters((current) => ({
      ...current,
      ballType:
        value === ALL_FILTER_VALUE
          ? null
          : value === BallType.Tennis || value === BallType.Leather
            ? value
            : null,
    }));
  }

  function applyFilters(): void {
    setAppliedFilters(draftFilters);
    setFiltersOpen(false);
  }

  function clearFilters(): void {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  const emptyMessage =
    hasSearchQuery || hasAppliedFilters
      ? 'No tournaments match your search or filters.'
      : 'No tournaments yet.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="z-10 gap-3 bg-background px-4 pb-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text variant="screenTitle" className="font-sans-bold text-on-surface">Tournaments</Text>
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
          rightAccessory={
            <Pressable
              onPress={toggleFiltersPanel}
              accessibilityRole="button"
              accessibilityLabel={filtersOpen ? 'Hide tournament filters' : 'Show tournament filters'}
              accessibilityState={{ expanded: filtersOpen }}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center active:opacity-70"
            >
              <MaterialIcons
                name="filter-list"
                size={22}
                color={hasAppliedFilters || filtersOpen ? FIELD_ORANGE : '#5A4136'}
              />
            </Pressable>
          }
        />
        {filtersOpen ? (
          <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-3">
            <View className="flex-row gap-3">
              <View className="min-w-0 flex-1">
                <Select
                  label="Province"
                  placeholder="All provinces"
                  value={draftFilters.provinceId ?? ALL_FILTER_VALUE}
                  options={provinceOptions}
                  onChange={handleDraftProvinceChange}
                  loading={geoLoading}
                  disabled={geoLoading}
                  error={geoError}
                  onRetry={() => void loadGeography()}
                  emptyMessage="No provinces found"
                  containerClassName="mb-0"
                />
              </View>
              <View className="min-w-0 flex-1">
                <Select
                  label="Center"
                  placeholder={
                    draftFilters.provinceId ? 'All centers' : 'Select a province first'
                  }
                  value={draftFilters.centerId ?? ALL_FILTER_VALUE}
                  options={centerOptions}
                  onChange={handleDraftCenterChange}
                  loading={geoLoading}
                  disabled={geoLoading || !draftFilters.provinceId}
                  emptyMessage={
                    draftFilters.provinceId
                      ? 'No centers in this province'
                      : 'Select a province first'
                  }
                  containerClassName="mb-0"
                />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="min-w-0 flex-1">
                <Select
                  label="Year"
                  placeholder="All years"
                  value={
                    draftFilters.year != null ? String(draftFilters.year) : ALL_FILTER_VALUE
                  }
                  options={yearOptions}
                  onChange={handleDraftYearChange}
                  containerClassName="mb-0"
                />
              </View>
              <View className="min-w-0 flex-1">
                <Select
                  label="Ball Type"
                  placeholder="All ball types"
                  value={draftFilters.ballType ?? ALL_FILTER_VALUE}
                  options={BALL_TYPE_OPTIONS}
                  onChange={handleDraftBallTypeChange}
                  containerClassName="mb-0"
                />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="min-w-0 flex-1">
                <Button
                  label="Clear"
                  variant="outline"
                  onPress={clearFilters}
                  className="h-11"
                />
              </View>
              <View className="min-w-0 flex-1">
                <Button label="Apply" onPress={applyFilters} className="h-11" />
              </View>
            </View>
          </View>
        ) : null}
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-8">
        {loading ? (
          <ActivityIndicator color={FIELD_ORANGE} className="py-12" />
        ) : error ? (
          <View className="rounded-xl bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : isEmpty ? (
          <Text className="font-sans text-sm text-on-surface-variant">{emptyMessage}</Text>
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
