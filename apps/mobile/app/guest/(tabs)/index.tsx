import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { buildGuestDashboardSections } from '../../../src/components/dashboard/buildGuestDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { GuestHeader } from '../../../src/components/ui/GuestHeader';
import { useGuestDashboard } from '../../../src/hooks/useGuestDashboard';
import { useGuestTabConfig } from '../../../src/lib/guest-tabs';

export default function GuestDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = useGuestDashboard();
  const tabConfig = useGuestTabConfig('index');

  const sections = useMemo(
    () => (dashboard ? buildGuestDashboardSections(dashboard, router) : []),
    [dashboard, router],
  );

  return (
    <DashboardScaffold
      header={<GuestHeader onProfilePress={() => router.push('/login')} />}
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      sections={sections}
      tabConfig={tabConfig}
    />
  );
}
