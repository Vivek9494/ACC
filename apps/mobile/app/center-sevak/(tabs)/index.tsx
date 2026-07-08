import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { buildCenterSevakDashboardSections } from '../../../src/components/dashboard/buildCenterSevakDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { useCenterSevakDashboard } from '../../../src/hooks/useCenterSevakDashboard';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { useAuth } from '../../../src/lib/auth-context';

export default function CenterSevakDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { dashboard, isLoading, error, retry } = useCenterSevakDashboard();
  const { broadcast } = useActiveBroadcast(!isLoading && !error);

  const sections = useMemo(() => {
    const base =
      dashboard && user
        ? buildCenterSevakDashboardSections(dashboard, router, user, retry, retry)
        : [];
    return prependBroadcastSection(base, broadcast);
  }, [broadcast, dashboard, router, retry, user]);

  return (
    <DashboardScaffold
      headerFallbackName="Sevak"
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      sections={sections}
    />
  );
}
