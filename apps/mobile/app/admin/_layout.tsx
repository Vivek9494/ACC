import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';

/** Admin-only section: dashboard tabs + management stack screens. */
export default function AdminLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.Admin) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="birthdays" />
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="provinces" />
      <Stack.Screen name="centers" />
      <Stack.Screen name="users/new" />
      <Stack.Screen name="users/[userId]" />
    </Stack>
  );
}
