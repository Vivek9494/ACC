import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { hasCenterSevakAccess } from '../../src/lib/center-sevak-access';
import { hasTeamLeadAccess } from '../../src/lib/team-lead-access';

/** Plain Player dashboard — redirects users with role-specific dashboards elsewhere. */
export default function HomeLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }
  if (user.role === UserRole.Admin) {
    return <Redirect href="/admin" />;
  }
  if (user.role === UserRole.ClubManager) {
    return <Redirect href="/club-manager" />;
  }
  if (hasTeamLeadAccess(user)) {
    return <Redirect href="/captain" />;
  }
  if (hasCenterSevakAccess(user)) {
    return <Redirect href="/center-sevak" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
