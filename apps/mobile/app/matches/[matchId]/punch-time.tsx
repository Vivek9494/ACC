import {
  isPunchTimeReadOnly,
  resolvePunchTimeViewScope,
  type MatchDetail,
} from '@acc/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PunchTimeScreen } from '../../../src/components/attendance/PunchTimeScreen';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { TabEmptyState, TabEmptyStateIconCircle } from '../../../src/components/ui/TabEmptyState';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getMatch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';

function PunchTimeRouteShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Punch Time" accentTitle />
      {children}
    </SafeAreaView>
  );
}

export default function PunchTimeRoute(): React.ReactElement {
  const { matchId, teamId: teamIdParam } = useLocalSearchParams<{
    matchId: string;
    teamId?: string;
  }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMatch(await getMatch(matchId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scope = useMemo(
    () => (match && user ? resolvePunchTimeViewScope(user, match) : null),
    [match, user],
  );

  const initialTeamId = useMemo(() => {
    if (!scope) {
      return null;
    }
    if (teamIdParam && scope.teams.some((team) => team.id === teamIdParam)) {
      return teamIdParam;
    }
    return scope.defaultTeamId;
  }, [scope, teamIdParam]);

  if (!matchId) {
    return <View className="flex-1 bg-background" />;
  }

  if (loading) {
    return (
      <PunchTimeRouteShell>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      </PunchTimeRouteShell>
    );
  }

  if (error || !scope || !initialTeamId) {
    const message =
      error ??
      'You do not have access to punch time for this match. Punch time is available for leather ACC matches you organize or captain.';

    return (
      <PunchTimeRouteShell>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center"
          keyboardShouldPersistTaps="handled"
        >
          <TabEmptyState
            icon={<TabEmptyStateIconCircle name="time-outline" />}
            message={message}
          />
        </ScrollView>
      </PunchTimeRouteShell>
    );
  }

  return (
    <PunchTimeRouteShell>
      <PunchTimeScreen
        matchId={matchId}
        teamId={initialTeamId}
        teamTabs={scope.showTeamTabs ? scope.teams : undefined}
        readOnly={match != null && isPunchTimeReadOnly(match.state)}
      />
    </PunchTimeRouteShell>
  );
}
