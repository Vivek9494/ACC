import { UserRole, type AuthUser } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { homeRouteForUserAsHref } from '../../src/lib/home-route';

/** Guest-only section — authenticated users are routed to their role dashboard. */
export default function GuestLayout(): React.ReactElement {
  const { user, status } = useAuth();

  if (status === 'authenticated' && user) {
    return <Redirect href={homeRouteForUserAsHref(user)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
