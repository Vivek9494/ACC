import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { hasCenterSevakAccess } from '../../src/lib/center-sevak-access';

/** Center Sevak-only dashboard section. */
export default function CenterSevakLayout(): React.ReactElement {
  const { user } = useAuth();

  const canAccess =
    user != null && (user.role === UserRole.CenterSevak || hasCenterSevakAccess(user));

  if (!canAccess) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
