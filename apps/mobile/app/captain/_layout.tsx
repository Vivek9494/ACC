import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { hasTeamLeadAccess } from '../../src/lib/team-lead-access';

/** Captain / Vice-Captain dashboard section. */
export default function CaptainLayout(): React.ReactElement {
  const { user } = useAuth();

  if (!user || !hasTeamLeadAccess(user)) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
