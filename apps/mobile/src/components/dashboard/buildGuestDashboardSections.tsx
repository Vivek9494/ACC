import type { GuestDashboard } from '@acc/types';
import type { Router } from 'expo-router';
import type { ReactNode } from 'react';

import { buildCaptainFeaturedMatchSections } from './buildDashboardFeaturedMatchSections';

export function buildGuestDashboardSections(
  dashboard: GuestDashboard,
  router: Router,
): ReactNode[] {
  return buildCaptainFeaturedMatchSections(dashboard.featuredMatches, router).filter(
    (section) => section !== null,
  );
}
