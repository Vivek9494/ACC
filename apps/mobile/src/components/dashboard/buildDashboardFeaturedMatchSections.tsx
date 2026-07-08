import {
  groupFeaturedMatchesByScheduledDay,
  groupFeaturedMatchSummariesByScheduledDay,
  type CaptainFeaturedMatchSummary,
  type FeaturedMatchSummary,
} from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';

import {
  captainFeaturedHref,
  captainFeaturedToEntry,
  featuredSummaryHref,
  featuredSummaryToEntry,
} from '../../lib/dashboard-featured-match';
import { DashboardFeaturedMatchDayGroup } from './DashboardFeaturedMatchDayGroup';

export function buildCaptainFeaturedMatchSections(
  matches: CaptainFeaturedMatchSummary[],
  router: Router,
): ReactNode[] {
  const groups = groupFeaturedMatchesByScheduledDay(matches);
  if (groups.length === 0) {
    return [];
  }

  return groups.map((group) => (
    <DashboardFeaturedMatchDayGroup
      key={`featured-day-${group.dayKey}`}
      entries={group.matches.map(captainFeaturedToEntry)}
      onPress={(matchId) => {
        const match = group.matches.find((item) => item.matchId === matchId);
        if (match) {
          router.push(captainFeaturedHref(match));
        }
      }}
    />
  ));
}

export function buildFeaturedSummaryMatchSections(
  matches: FeaturedMatchSummary[],
  router: Router,
): ReactNode[] {
  const groups = groupFeaturedMatchSummariesByScheduledDay(matches);
  if (groups.length === 0) {
    return [];
  }

  return groups.map((group) => (
    <DashboardFeaturedMatchDayGroup
      key={`featured-day-${group.dayKey}`}
      entries={group.matches.map(featuredSummaryToEntry)}
      onPress={(matchId) => {
        const match = group.matches.find((item) => item.matchId === matchId);
        if (match) {
          router.push(featuredSummaryHref(match));
        }
      }}
    />
  ));
}
