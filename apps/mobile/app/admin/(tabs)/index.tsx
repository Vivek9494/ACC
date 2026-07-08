import type { AdminOverview, TournamentDashboardEntry } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from '../../../src/components/dashboard/buildDashboardFeaturedMatchSections';
import { buildTournamentMenuActions } from '../../../src/components/dashboard/buildTournamentMenuActions';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { Card } from '../../../src/components/ui/Card';
import { CircularAddButton } from '../../../src/components/ui/CircularAddButton';
import { StatTile } from '../../../src/components/ui/StatTile';
import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { getAdminOverview, listTournamentDashboardEntries } from '../../../src/lib/api';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { dashboardFetchError, logFetchError } from '../../../src/lib/fetch-error';
import { useAuth } from '../../../src/lib/auth-context';
import { tournamentDetailHref } from '../../../src/lib/tournament-detail-route';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactElement {
  return (
    <View className="flex-1 gap-1">
      <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className="font-sans-bold text-2xl text-on-surface">{value}</Text>
    </View>
  );
}

export default function AdminDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tournaments, setTournaments] = useState<TournamentDashboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { broadcast } = useActiveBroadcast(!loading && !error);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getAdminOverview(), listTournamentDashboardEntries()])
      .then(([stats, tourList]) => {
        if (cancelled) return;
        setOverview(stats);
        setTournaments(tourList);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load admin dashboard', err);
        if (!cancelled) {
          setError(dashboardFetchError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  const glanceItems = overview
    ? [
        { label: 'Tournaments', value: overview.tournamentCount },
        { label: 'Matches Today', value: overview.matchesTodayCount, highlight: true },
        { label: 'Pending Approvals', value: overview.pendingApprovalsCount },
      ]
    : [];

  const sections = useMemo(() => {
    if (!overview) {
      return [];
    }

    return [
      ...buildCaptainFeaturedMatchSections(overview.featuredMatches, router),
      <Card accent key="system-overview">
        <Text className="mb-4 font-sans-bold text-lg text-on-surface">System Overview</Text>
        <View className="gap-4">
          <View className="flex-row gap-4">
            <OverviewMetric label="Provinces" value={overview.provinceCount} />
            <OverviewMetric label="Centers" value={overview.centerCount} />
          </View>
          <View className="flex-row gap-4">
            <OverviewMetric label="Active Tournaments" value={overview.activeTournamentCount} />
            <OverviewMetric label="Total Users" value={overview.totalUserCount} />
          </View>
        </View>
      </Card>,
      glanceItems.length > 0 ? (
        <StatTile key="at-a-glance" title="At a Glance" items={glanceItems} />
      ) : null,
      tournaments.length > 0 ? (
        <View key="tournaments" className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
            <CircularAddButton
              accessibilityLabel="Add tournament"
              onPress={() => router.push('/tournaments/new')}
            />
          </View>
          {tournaments.map(({ tournament, permissions }) => (
            <TournamentDashboardCard
              key={tournament.id}
              tournament={tournament}
              onPress={() => user && router.push(tournamentDetailHref(user, tournament.id))}
              menuActions={buildTournamentMenuActions(
                permissions,
                tournament.id,
                tournament.name,
                router,
                { onDeleted: load },
              )}
            />
          ))}
        </View>
      ) : null,
    ].filter((section) => section !== null);
  }, [glanceItems, load, overview, router, tournaments, user]);

  const sectionsWithBroadcast = useMemo(
    () => prependBroadcastSection(sections, broadcast),
    [broadcast, sections],
  );

  return (
    <DashboardScaffold
      headerFallbackName="Admin"
      isLoading={loading}
      error={error}
      onRetry={load}
      sections={sectionsWithBroadcast}
    />
  );
}
