import { resolvePunchTimeViewScope, type MatchDetail } from '@acc/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PunchTimeScreen } from '../../../src/components/attendance/PunchTimeScreen';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getMatch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';

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
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['top']}>
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (error || !scope || !initialTeamId) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6" edges={['top']}>
        <View className="flex-1 justify-center">
          <Text className="font-sans text-base text-on-surface-variant">
            {error ?? 'You do not have access to punch time for this match.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <PunchTimeScreen
        matchId={matchId}
        teamId={initialTeamId}
        teamTabs={scope.showTeamTabs ? scope.teams : undefined}
      />
    </SafeAreaView>
  );
}
