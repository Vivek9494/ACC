import { type ClubManagerDashboard, type CaptainScorerAssignmentMatch } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { buildCaptainFeaturedMatchSections } from '../../../src/components/dashboard/buildDashboardFeaturedMatchSections';
import { buildTeamLeadPollSections } from '../../../src/components/dashboard/buildTeamLeadPollSections';
import { buildTournamentMenuActions } from '../../../src/components/dashboard/buildTournamentMenuActions';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { YourPerformanceSection } from '../../../src/components/dashboard/YourPerformanceSection';
import { AssignScorerDialog } from '../../../src/components/scoring/AssignScorerDialog';
import { CircularAddButton } from '../../../src/components/ui/CircularAddButton';
import { Text } from '../../../src/components/ui/Text';
import { TournamentDashboardCard } from '../../../src/components/ui/TournamentDashboardCard';
import { getClubManagerDashboard } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { dashboardFetchError, logFetchError } from '../../../src/lib/fetch-error';
import { tournamentNewHref } from '../../../src/lib/tournament-detail-route';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';

export default function ClubManagerDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ClubManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignmentMatch, setAssignmentMatch] = useState<CaptainScorerAssignmentMatch | null>(null);
  const { broadcast } = useActiveBroadcast(!loading && !error);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getClubManagerDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((err: unknown) => {
        logFetchError('Failed to load club manager dashboard', err);
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

  const sections = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      ...buildCaptainFeaturedMatchSections(dashboard.featuredMatches, router),
      ...buildTeamLeadPollSections(
        dashboard.upcomingMatchCard,
        dashboard.participationPoll,
        (match) => setAssignmentMatch(match),
        load,
      ),
      dashboard.playerStats != null ? (
        <YourPerformanceSection key="performance" performance={dashboard.playerStats} />
      ) : null,
      dashboard.tournaments.length > 0 ? (
        <View key="tournaments" className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans-bold text-xl text-on-surface">Tournaments</Text>
            <CircularAddButton
              accessibilityLabel="Add tournament"
              onPress={() => router.push(tournamentNewHref(user))}
            />
          </View>
          {dashboard.tournaments.map(({ tournament, permissions }) => (
            <TournamentDashboardCard
              key={tournament.id}
              tournament={tournament}
              onPress={() => router.push(`/club-manager/tournament/${tournament.id}`)}
              menuActions={buildTournamentMenuActions(
                permissions,
                tournament.id,
                tournament.name,
                router,
                { onDeleted: load, user },
              )}
            />
          ))}
        </View>
      ) : null,
    ].filter((section) => section !== null);
  }, [dashboard, load, router, user]);

  const sectionsWithBroadcast = useMemo(
    () => prependBroadcastSection(sections, broadcast),
    [broadcast, sections],
  );

  return (
    <>
      <DashboardScaffold
        headerFallbackName="Manager"
        isLoading={loading}
        error={error}
        onRetry={load}
        sections={sectionsWithBroadcast}
      />
      <AssignScorerDialog
        visible={assignmentMatch !== null}
        matchId={assignmentMatch?.matchId ?? null}
        assignedScorerUserId={assignmentMatch?.assignedScorer?.userId ?? null}
        onClose={() => setAssignmentMatch(null)}
        onAssigned={load}
      />
    </>
  );
}
