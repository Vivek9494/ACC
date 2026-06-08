import { UserRole } from '@acc/types';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';

/** Admin-only section gate. */
export default function AdminLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.Admin) {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
