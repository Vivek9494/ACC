import type { CaptainScorerAssignmentMatch, ScorerStartableMatch } from '@acc/types';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { buildCaptainDashboardSections } from '../../../src/components/dashboard/buildCaptainDashboardSections';
import { DashboardScaffold } from '../../../src/components/dashboard/DashboardScaffold';
import { MatchSetupDialog } from '../../../src/components/dashboard/MatchSetupDialog';
import { AssignScorerDialog } from '../../../src/components/scoring/AssignScorerDialog';
import { useCaptainDashboard } from '../../../src/hooks/useCaptainDashboard';
import { useActiveBroadcast } from '../../../src/hooks/useActiveBroadcast';
import { useAttendanceMonitor } from '../../../src/hooks/useAttendanceMonitor';
import { prependBroadcastSection } from '../../../src/lib/dashboard-broadcast';
import { useAuth } from '../../../src/lib/auth-context';

export default function CaptainDashboardScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { dashboard, isLoading, error, retry } = useCaptainDashboard();
  const { broadcast } = useActiveBroadcast(!isLoading && !error);
  useAttendanceMonitor(true);
  const [assignmentMatch, setAssignmentMatch] = useState<CaptainScorerAssignmentMatch | null>(null);
  const [setupMatch, setSetupMatch] = useState<ScorerStartableMatch | null>(null);

  const sections = useMemo(() => {
    const base =
      dashboard && user
        ? buildCaptainDashboardSections(
            dashboard,
            router,
            user,
            (match) => setAssignmentMatch(match),
            retry,
            (match) => setSetupMatch(match),
          )
        : [];
    return prependBroadcastSection(base, broadcast);
  }, [broadcast, dashboard, router, retry, user]);

  return (
    <>
      <DashboardScaffold
        headerFallbackName="Captain"
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        sections={sections}
      />
      <AssignScorerDialog
        visible={assignmentMatch !== null}
        matchId={assignmentMatch?.matchId ?? null}
        assignedScorerUserId={assignmentMatch?.assignedScorer?.userId ?? null}
        onClose={() => setAssignmentMatch(null)}
        onAssigned={retry}
      />
      <MatchSetupDialog
        visible={setupMatch !== null}
        match={setupMatch}
        onClose={() => setSetupMatch(null)}
      />
    </>
  );
}
