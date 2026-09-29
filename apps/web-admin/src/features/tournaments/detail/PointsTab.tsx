import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { StandingsTables } from '@/features/statistics/tournament-stats/StandingsTables';
import { useTournamentStandings } from '@/features/statistics/tournament-stats/tournament-stats-api';

export function PointsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const standings = useTournamentStandings(tournamentId);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void standings.refetch()} disabled={standings.isFetching}>
          <RefreshCw className={standings.isFetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>
      <StandingsTables standings={standings} />
    </div>
  );
}
