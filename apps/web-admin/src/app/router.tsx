import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import { RequireAdmin } from '@/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { StatisticsLayout } from '@/features/statistics/StatisticsLayout';
import { DetailsTab } from '@/features/tournaments/detail/DetailsTab';
import { GroupsTab } from '@/features/tournaments/detail/GroupsTab';
import { MatchesTab } from '@/features/tournaments/detail/MatchesTab';
import { MatchScorecardPage } from '@/features/tournaments/detail/MatchScorecardPage';
import { PointsTab } from '@/features/tournaments/detail/PointsTab';
import { RegistrationsTab } from '@/features/tournaments/detail/RegistrationsTab';
import { StatsTab } from '@/features/tournaments/detail/StatsTab';
import { TeamsTab } from '@/features/tournaments/detail/TeamsTab';
import { TournamentDetailLayout } from '@/features/tournaments/detail/TournamentDetailLayout';
import { CreateTournamentPage, EditTournamentPage } from '@/features/tournaments/manage/TournamentFormPage';
import { TournamentsPage } from '@/features/tournaments/TournamentsPage';
import { RequireNavRole } from '@/auth/RequireNavRole';
import { BroadcastPage } from '@/features/broadcast/BroadcastPage';
import { GeographyManagementPage } from '@/features/geography/GeographyManagementPage';
import { LogsPage } from '@/features/audit-logs/LogsPage';
import { OverlayPage } from '@/features/overlay/OverlayPage';
import { ProvinceCentersPage } from '@/features/geography/ProvinceCentersPage';
import { RulebookPage } from '@/features/rulebook/RulebookPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { VerificationPage } from '@/features/verification/VerificationPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { DEFAULT_ROUTE, NAV_ITEMS } from './nav';

// Split out of the main bundle (recharts lives in the OTP section).
const OtpAnalyticsPage = lazy(() =>
  import('@/features/statistics/otp/OtpAnalyticsPage').then((m) => ({
    default: m.OtpAnalyticsPage,
  })),
);
const GeographyPage = lazy(() =>
  import('@/features/statistics/geography/GeographyPage').then((m) => ({
    default: m.GeographyPage,
  })),
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
          { path: 'tournaments/new', element: <CreateTournamentPage /> },
          { path: 'tournaments/:tournamentId/edit', element: <EditTournamentPage /> },
          { path: 'verification', element: <VerificationPage /> },
          {
            path: 'tournaments/:tournamentId',
            element: <TournamentDetailLayout />,
            children: [
              { index: true, element: <Navigate to="teams" replace /> },
              { path: 'teams', element: <TeamsTab /> },
              { path: 'groups', element: <GroupsTab /> },
              { path: 'matches', element: <MatchesTab /> },
              { path: 'matches/:matchId', element: <MatchScorecardPage /> },
              { path: 'points', element: <PointsTab /> },
              { path: 'stats', element: <StatsTab /> },
              { path: 'registrations', element: <RegistrationsTab /> },
              { path: 'details', element: <DetailsTab /> },
            ],
          },
          { path: 'users', element: <UsersPage /> },
          {
            element: <RequireNavRole path="/geography" />,
            children: [
              { path: 'geography', element: <GeographyManagementPage /> },
              { path: 'geography/provinces/:provinceId', element: <ProvinceCentersPage /> },
            ],
          },
          {
            path: 'statistics',
            element: <StatisticsLayout />,
            children: [
              { path: 'otp', element: <OtpAnalyticsPage /> },
              { path: 'geography', element: <GeographyPage /> },
              { path: 'tournaments', element: <TournamentStatsPage /> },
            ],
          },
          { path: 'broadcast', element: <BroadcastPage /> },
          {
            element: <RequireNavRole path="/rulebook" />,
            children: [{ path: 'rulebook', element: <RulebookPage /> }],
          },
          {
            element: <RequireNavRole path="/logs" />,
            children: [{ path: 'logs', element: <LogsPage /> }],
          },
          {
            element: <RequireNavRole path="/overlay" />,
            children: [{ path: 'overlay', element: <OverlayPage /> }],
          },
          { path: 'settings', element: <SettingsPage /> },
          ...stubRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
