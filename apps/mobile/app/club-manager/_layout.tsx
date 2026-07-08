import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';

/** Club Manager — stack for tab roots + detail overlays. Bottom bar lives in `(tabs)/_layout`. */
export default function ClubManagerLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.ClubManager) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="birthdays" />
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="users/[userId]" />
    </Stack>
  );
}
