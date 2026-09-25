import type { CaptainFeaturedMatchSummary, FeaturedMatchSummary } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  captainFeaturedHref,
  captainFeaturedToEntry,
  featuredSummaryHref,
  featuredSummaryToEntry,
  guestFeaturedHref,
  type DashboardFeaturedMatchEntry,
} from '../../lib/dashboard-featured-match';
import { Text } from '../ui/Text';
import { DashboardFeaturedMatchList } from './DashboardFeaturedMatchList';

type FeaturedHref = `/matches/${string}` | `/matches/${string}/live` | `/matches/${string}/scorecard`;

function titledMatchSection(
  key: string,
  title: string,
  entries: DashboardFeaturedMatchEntry[],
  onPress: (matchId: string) => void,
): ReactNode {
  if (entries.length === 0) {
    return null;
  }

  return (
    <View key={key} className="gap-3">
      <Text variant="section" className="font-sans-bold text-on-surface">
        {title}
      </Text>
      <DashboardFeaturedMatchList entries={entries} onPress={onPress} />
    </View>
  );
}

/**
 * Shared Live (top) + Upcoming (below) sections for guest and all role homes.
 * Hidden when empty; single card at 1; carousel at 2+.
 */
export function buildLiveUpcomingMatchSections(
  liveMatches: CaptainFeaturedMatchSummary[],
  upcomingMatches: CaptainFeaturedMatchSummary[],
  router: Router,
  resolveHref: (match: CaptainFeaturedMatchSummary) => FeaturedHref = captainFeaturedHref,
): ReactNode[] {
  const pressFor = (matches: CaptainFeaturedMatchSummary[]) => (matchId: string) => {
    const match = matches.find((item) => item.matchId === matchId);
    if (match) {
      router.push(resolveHref(match));
    }
  };

  return [
    titledMatchSection(
      'live-matches',
      'Live',
      liveMatches.map(captainFeaturedToEntry),
      pressFor(liveMatches),
    ),
    titledMatchSection(
      'upcoming-matches',
      'Upcoming',
      upcomingMatches.map(captainFeaturedToEntry),
      pressFor(upcomingMatches),
    ),
  ].filter((section) => section !== null);
}

/** Role homes: Live + Upcoming with authenticated match routes. */
export function buildCaptainFeaturedMatchSections(
  liveMatches: CaptainFeaturedMatchSummary[],
  upcomingMatches: CaptainFeaturedMatchSummary[],
  router: Router,
): ReactNode[] {
  return buildLiveUpcomingMatchSections(
    liveMatches,
    upcomingMatches,
    router,
    captainFeaturedHref,
  );
}

/** Guest home: Live + Upcoming with public live/scorecard routes. */
export function buildGuestLiveUpcomingMatchSections(
  liveMatches: CaptainFeaturedMatchSummary[],
  upcomingMatches: CaptainFeaturedMatchSummary[],
  router: Router,
): ReactNode[] {
  return buildLiveUpcomingMatchSections(
    liveMatches,
    upcomingMatches,
    router,
    guestFeaturedHref,
  );
}

/** @deprecated Prefer {@link buildCaptainFeaturedMatchSections} with live + upcoming lists. */
export function buildFeaturedSummaryMatchSections(
  matches: FeaturedMatchSummary[],
  router: Router,
): ReactNode[] {
  if (matches.length === 0) {
    return [];
  }

  return [
    titledMatchSection(
      'featured-summaries',
      'Matches',
      matches.map(featuredSummaryToEntry),
      (matchId) => {
        const match = matches.find((item) => item.matchId === matchId);
        if (match) {
          router.push(featuredSummaryHref(match));
        }
      },
    ),
  ].filter((section) => section !== null);
}
