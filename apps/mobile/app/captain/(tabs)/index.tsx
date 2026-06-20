import type { CaptainScorerAssignmentMatch } from '@acc/types';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { buildCaptainDashboardSections } from '../../../src/components/dashboard/buildCaptainDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { AssignScorerDialog } from '../../../src/components/scoring/AssignScorerDialog';
import { useCaptainDashboard } from '../../../src/hooks/useCaptainDashboard';
import { useAttendanceMonitor } from '../../../src/hooks/useAttendanceMonitor';
import { useCaptainTabConfig } from '../../../src/lib/captain-tabs';

export default function CaptainDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { dashboard, isLoading, error, retry } = useCaptainDashboard();
  useAttendanceMonitor(true);
  const tabConfig = useCaptainTabConfig('index');
  const [assignmentMatch, setAssignmentMatch] = useState<CaptainScorerAssignmentMatch | null>(null);

  const sections = useMemo(
    () =>
      dashboard
        ? buildCaptainDashboardSections(
            dashboard,
            router,
            (match) => setAssignmentMatch(match),
            retry,
          )
        : [],
    [dashboard, router, retry],
  );

  return (
    <>
      <DashboardScaffold
        headerFallbackName="Captain"
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        sections={sections}
        tabConfig={tabConfig}
      />
      <AssignScorerDialog
        visible={assignmentMatch !== null}
        matchId={assignmentMatch?.matchId ?? null}
        assignedScorerUserId={assignmentMatch?.assignedScorer?.userId ?? null}
        onClose={() => setAssignmentMatch(null)}
        onAssigned={retry}
      />
    </>
  );
}
