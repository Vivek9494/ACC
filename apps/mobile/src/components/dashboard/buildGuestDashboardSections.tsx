import type { CaptainFeaturedMatchSummary, GuestDashboard } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  captainFeaturedToEntry,
  guestFeaturedHref,
} from '../../lib/dashboard-featured-match';
import { MatchSummaryCard } from '../ui/MatchSummaryCard';
import { Text } from '../ui/Text';
import { TournamentDashboardCard } from '../ui/TournamentDashboardCard';
import { buildGuestLiveUpcomingMatchSections } from './buildDashboardFeaturedMatchSections';

function guestRecentSection(
  match: CaptainFeaturedMatchSummary,
  router: Router,
): ReactNode {
  const entry = captainFeaturedToEntry(match);
  return (
    <View key="recent-match" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Recent</Text>
      <MatchSummaryCard
        {...entry.card}
        onPress={() => router.push(guestFeaturedHref(match))}
      />
    </View>
  );
}

function guestTournamentSection(
  dashboard: GuestDashboard,
  router: Router,
): ReactNode | null {
  const tournament = dashboard.featuredTournament;
  if (!tournament) {
    return null;
  }
  return (
    <View key="featured-tournament" className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Tournament</Text>
      <TournamentDashboardCard
        tournament={tournament}
        onPress={() => router.push(`/tournaments/${tournament.id}`)}
      />
    </View>
  );
}

export function buildGuestDashboardSections(
  dashboard: GuestDashboard,
  router: Router,
): ReactNode[] {
  const sections: ReactNode[] = [
    ...buildGuestLiveUpcomingMatchSections(
      dashboard.liveMatches,
      dashboard.upcomingMatches,
      router,
    ),
  ];

  if (dashboard.recentMatch) {
    sections.push(guestRecentSection(dashboard.recentMatch, router));
  }

  const tournamentSection = guestTournamentSection(dashboard, router);
  if (tournamentSection) {
    sections.push(tournamentSection);
  }

  if (sections.length === 0) {
    return [
      <View key="empty" className="gap-2 py-4">
        <Text className="font-sans text-base text-on-surface-variant">
          Nothing to show yet. Check back soon for upcoming matches and tournaments.
        </Text>
      </View>,
    ];
  }

  return sections;
}
