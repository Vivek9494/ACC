import { UserRole, type AuthUser } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { hasCenterSevakAccess } from '../../src/lib/center-sevak-access';
import { hasTeamLeadAccess } from '../../src/lib/team-lead-access';

function homeRouteForAuthenticatedUser(user: AuthUser): '/admin' | '/club-manager' | '/captain' | '/center-sevak' | '/home' {
  if (user.role === UserRole.Admin) {
    return '/admin';
  }
  if (user.role === UserRole.ClubManager) {
    return '/club-manager';
  }
  if (hasTeamLeadAccess(user)) {
    return '/captain';
  }
  if (hasCenterSevakAccess(user)) {
    return '/center-sevak';
  }
  return '/home';
}

/** Guest-only section — authenticated users are routed to their role dashboard. */
export default function GuestLayout(): React.ReactElement {
  const { user, status } = useAuth();

  if (status === 'authenticated' && user) {
    return <Redirect href={homeRouteForAuthenticatedUser(user)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
