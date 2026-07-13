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

function guestMatchSection(
  key: string,
  title: string,
  match: CaptainFeaturedMatchSummary,
  router: Router,
): ReactNode {
  const entry = captainFeaturedToEntry(match);
  return (
    <View key={key} className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">{title}</Text>
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
  if (dashboard.liveMatch) {
    const sections: ReactNode[] = [
      guestMatchSection('live-match', 'Live', dashboard.liveMatch, router),
    ];
    const tournamentSection = guestTournamentSection(dashboard, router);
    if (tournamentSection) {
      sections.push(tournamentSection);
    }
    return sections;
  }

  const sections: ReactNode[] = [];
  if (dashboard.upcomingMatch) {
    sections.push(
      guestMatchSection('upcoming-match', 'Upcoming', dashboard.upcomingMatch, router),
    );
  }
  if (dashboard.recentMatch) {
    sections.push(
      guestMatchSection('recent-match', 'Recent', dashboard.recentMatch, router),
    );
  }
  const tournamentSection = guestTournamentSection(dashboard, router);
  if (tournamentSection) {
    sections.push(tournamentSection);
  }

  if (sections.length === 0) {
    return [
      <View key="empty" className="gap-2 py-4">
        <Text className="font-sans text-base text-on-surface-variant">
          No matches scheduled yet. Browse tournaments to see what&apos;s coming up.
        </Text>
      </View>,
    ];
  }

  return sections;
}
