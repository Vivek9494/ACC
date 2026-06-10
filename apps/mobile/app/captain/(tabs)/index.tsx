import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { buildCaptainDashboardSections } from '../../../src/components/dashboard/buildCaptainDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { useCaptainDashboard } from '../../../src/hooks/useCaptainDashboard';
import { useCaptainTabConfig } from '../../../src/lib/captain-tabs';

export default function CaptainDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = useCaptainDashboard();
  const tabConfig = useCaptainTabConfig('index');

  const sections = useMemo(
    () => (dashboard ? buildCaptainDashboardSections(dashboard, router) : []),
    [dashboard, router],
  );

  return (
    <DashboardScaffold
      headerFallbackName="Captain"
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      sections={sections}
      tabConfig={tabConfig}
    />
  );
}
