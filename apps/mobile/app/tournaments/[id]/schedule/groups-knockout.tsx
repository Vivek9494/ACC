import { MatchSchedulingFormat } from '@acc/types';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ScheduleGroupsKnockoutScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect
      href={{
        pathname: '/tournaments/[id]/match-setup',
        params: { id: id ?? '', format: MatchSchedulingFormat.GroupStageKnockout },
      }}
    />
  );
}
