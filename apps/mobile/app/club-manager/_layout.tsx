import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';

/** Club Manager-only section: dashboard tabs. */
export default function ClubManagerLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.ClubManager) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
