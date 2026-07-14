import { MatchSchedulingFormat } from '@acc/types';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../../src/lib/auth-context';
import { tournamentSubpathHref } from '../../../../../src/lib/tournament-detail-route';

export default function ScheduleRoundRobinScreen(): React.ReactElement {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect
      href={tournamentSubpathHref(user, id ?? '', 'match-setup', {
        format: MatchSchedulingFormat.RoundRobin,
      })}
    />
  );
}
