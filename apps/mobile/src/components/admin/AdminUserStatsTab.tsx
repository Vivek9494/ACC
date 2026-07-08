import { BallType, type AdminUserPlayerStatsView } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PlayerCareerStatsContent } from '../tournament/player-profile/PlayerCareerStatsContent';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { ApiRequestError, getAdminUserStats } from '../../lib/api';

export interface AdminUserStatsTabProps {
  userId: string;
}

const BALL_TYPE_TABS = [
  { value: BallType.Leather, label: 'Leather' },
  { value: BallType.Tennis, label: 'Tennis' },
] as const;

function emptyStatsMessage(ballType: typeof BallType.Leather | typeof BallType.Tennis): string {
  return ballType === BallType.Leather ? 'No Leather stats' : 'No Tennis stats';
}

/** Stats tab for admin user detail — ball-type sub-tabs + full career stats. */
export function AdminUserStatsTab({ userId }: AdminUserStatsTabProps): React.ReactElement {
  const [ballType, setBallType] = useState<typeof BallType.Leather | typeof BallType.Tennis>(
    BallType.Leather,
  );
  const [stats, setStats] = useState<AdminUserPlayerStatsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAdminUserStats(userId, ballType)
      .then(setStats)
      .catch((err: unknown) => {
        setStats(null);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not load player stats.',
        );
      })
      .finally(() => setLoading(false));
  }, [ballType, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="gap-4">
      <UnderlineTabBar
        options={BALL_TYPE_TABS}
        value={ballType}
        onChange={setBallType}
        accessibilityLabel="Ball type"
        layout="spread"
      />

      {loading ? (
        <View className="items-center py-12">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <Text className="font-sans text-sm text-primary">{error}</Text>
      ) : null}

      {!loading && stats && stats.career.matches === 0 ? (
        <View className="rounded-xl border border-outline-variant bg-surface px-4 py-8">
          <Text className="text-center font-sans text-base text-text-muted">
            {emptyStatsMessage(ballType)}
          </Text>
        </View>
      ) : null}

      {!loading && stats && stats.career.matches > 0 ? (
        <PlayerCareerStatsContent
          ballTypeLabel={stats.ballTypeLabel}
          career={stats.career}
          byYear={stats.byYear}
          byTournament={stats.byTournament}
          showStumpingsCard={stats.showStumpingsCard}
          hideBallTypeLabel
        />
      ) : null}
    </View>
  );
}
