import type { AdminOverview } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AdminPasswordResetOtpAnalyticsCard } from '../../../src/components/admin/AdminPasswordResetOtpAnalyticsCard';
import { AdminUsersByGeographyAccordion } from '../../../src/components/admin/AdminUsersByGeographyAccordion';
import { buildCaptainFeaturedMatchSections } from '../../../src/components/dashboard/buildDashboardFeaturedMatchSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { ScorerStartMatchCard } from '../../../src/components/dashboard/ScorerStartMatchCard';
import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';
import { getAdminOverview } from '../../../src/lib/api';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { dashboardFetchError, logFetchError } from '../../../src/lib/fetch-error';
import {
  handleScorerDashboardPress,
  scorerDashboardButtonLabel,
} from '../../../src/lib/scorer-dashboard';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';

/** Two caption lines (12/16) so 1- and 2-line labels share the same number baseline. */
const OVERVIEW_LABEL_MIN_HEIGHT = 32;

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactElement {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text
        numberOfLines={2}
        className="font-sans-medium text-caption uppercase tracking-wider text-on-surface-variant"
        style={{ minHeight: OVERVIEW_LABEL_MIN_HEIGHT }}
      >
        {label}
      </Text>
      <Text className="font-sans-bold text-2xl text-on-surface">{value}</Text>
    </View>
  );
}

export default function AdminDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { broadcast } = useActiveBroadcast(!loading && !error);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminOverview()
      .then((stats) => {
        if (!cancelled) setOverview(stats);
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

  const sections = useMemo(() => {
    if (!overview) {
      return [];
    }

    return [
      overview.scorerMatch ? (
        <ScorerStartMatchCard
          key="scorer-match"
          match={overview.scorerMatch}
          buttonLabel={scorerDashboardButtonLabel(overview.scorerMatch)}
          onStartPress={() =>
            handleScorerDashboardPress(overview.scorerMatch!, router)
          }
        />
      ) : null,
      ...buildCaptainFeaturedMatchSections(
        overview.liveMatches,
        overview.upcomingMatches,
        router,
      ),
      <Card accent key="system-overview">
        <Text className="mb-4 font-sans-bold text-lg text-on-surface">System Overview</Text>
        <View className="gap-4">
          <View className="flex-row gap-4">
            <OverviewMetric label="Provinces" value={overview.provinceCount} />
            <OverviewMetric label="Centers" value={overview.centerCount} />
          </View>
          <View className="flex-row gap-4">
            <OverviewMetric label="Completed Tournaments" value={overview.completedTournamentCount} />
            <OverviewMetric label="Total Users" value={overview.totalUserCount} />
          </View>
        </View>
      </Card>,
      <AdminPasswordResetOtpAnalyticsCard key="password-reset-otp-analytics" />,
      <AdminUsersByGeographyAccordion key="users-by-geography" />,
    ].filter((section) => section !== null);
  }, [overview, router]);

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
