import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import { RequireAdmin } from '@/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { StatisticsLayout } from '@/features/statistics/StatisticsLayout';
import { MatchesTab } from '@/features/tournaments/detail/MatchesTab';
import { MatchScorecardPage } from '@/features/tournaments/detail/MatchScorecardPage';
import { PointsTab } from '@/features/tournaments/detail/PointsTab';
import { RegistrationsTab } from '@/features/tournaments/detail/RegistrationsTab';
import { StatsTab } from '@/features/tournaments/detail/StatsTab';
import { TeamsTab } from '@/features/tournaments/detail/TeamsTab';
import { TournamentDetailLayout } from '@/features/tournaments/detail/TournamentDetailLayout';
import { TournamentsPage } from '@/features/tournaments/TournamentsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { VerificationPage } from '@/features/verification/VerificationPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { DEFAULT_ROUTE, NAV_ITEMS } from './nav';

// Split out of the main bundle (recharts lives in the OTP section).
const OtpAnalyticsPage = lazy(() =>
  import('@/features/statistics/otp/OtpAnalyticsPage').then((m) => ({ default: m.OtpAnalyticsPage })),
);
const GeographyPage = lazy(() =>
  import('@/features/statistics/geography/GeographyPage').then((m) => ({ default: m.GeographyPage })),
);
const TournamentStatsPage = lazy(() =>
  import('@/features/statistics/tournament-stats/TournamentStatsPage').then((m) => ({
    default: m.TournamentStatsPage,
  })),
);

const stubRoutes = NAV_ITEMS.filter((item) => !item.available).map((item) => ({
  path: item.path.slice(1),
  element: <ComingSoonPage item={item} />,
}));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to={DEFAULT_ROUTE} replace /> },
          { path: 'tournaments', element: <TournamentsPage /> },
          { path: 'verification', element: <VerificationPage /> },
          {
            path: 'tournaments/:tournamentId',
            element: <TournamentDetailLayout />,
            children: [
              { index: true, element: <Navigate to="teams" replace /> },
              { path: 'teams', element: <TeamsTab /> },
              { path: 'matches', element: <MatchesTab /> },
              { path: 'matches/:matchId', element: <MatchScorecardPage /> },
              { path: 'points', element: <PointsTab /> },
              { path: 'stats', element: <StatsTab /> },
              { path: 'registrations', element: <RegistrationsTab /> },
            ],
          },
          { path: 'users', element: <UsersPage /> },
          {
            path: 'statistics',
            element: <StatisticsLayout />,
            children: [
              { path: 'otp', element: <OtpAnalyticsPage /> },
              { path: 'geography', element: <GeographyPage /> },
              { path: 'tournaments', element: <TournamentStatsPage /> },
            ],
          },
          ...stubRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
