import {
  BallType,
  dashboardPlayedBallTypes,
  MY_MATCHES_BALL_TYPE_LABEL,
  statsForDashboardBallType,
  type BallType as BallTypeValue,
  type DashboardPlayerPerformance,
  type ManagerPlayerStats,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl } from '../ui/SegmentedControl';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';

const BALL_TYPE_ORDER: BallTypeValue[] = [BallType.Leather, BallType.Tennis];

function performanceItems(stats: ManagerPlayerStats) {
  return [
    { label: 'Matches', value: stats.matches },
    { label: 'Runs', value: stats.runs, highlight: true },
    {
      label: 'Wickets',
      value: String(stats.wickets).padStart(2, '0'),
    },
  ];
}

export interface YourPerformanceSectionProps {
  performance: DashboardPlayerPerformance;
}

/**
 * Dashboard “Your Performance” — Matches / Runs / Wickets per ball type.
 * Shows the Leather/Tennis capsule only when the user has played both formats.
 */
export function YourPerformanceSection({
  performance,
}: YourPerformanceSectionProps): React.ReactElement {
  const playedBallTypes = useMemo(() => dashboardPlayedBallTypes(performance), [performance]);
  const showSwitch = playedBallTypes.length > 1;
  const [selectedBallType, setSelectedBallType] = useState<BallTypeValue>(() => {
    if (playedBallTypes.includes(BallType.Leather)) {
      return BallType.Leather;
    }
    return playedBallTypes[0] ?? BallType.Leather;
  });

  useEffect(() => {
    setSelectedBallType((prev) => {
      if (playedBallTypes.includes(prev)) {
        return prev;
      }
      if (playedBallTypes.includes(BallType.Leather)) {
        return BallType.Leather;
      }
      return playedBallTypes[0] ?? BallType.Leather;
    });
  }, [playedBallTypes]);

  const activeBallType = showSwitch
    ? selectedBallType
    : (playedBallTypes[0] ?? BallType.Leather);
  const stats = statsForDashboardBallType(performance, activeBallType);
  const switchOptions = useMemo(
    () =>
      BALL_TYPE_ORDER.filter((ballType) => playedBallTypes.includes(ballType)).map(
        (ballType) => ({
          value: ballType,
          label: MY_MATCHES_BALL_TYPE_LABEL[ballType],
        }),
      ),
    [playedBallTypes],
  );

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Text className="min-w-0 shrink font-sans-bold text-xl text-on-surface">
          Your Performance
        </Text>
        {showSwitch ? (
          <View className="shrink-0">
            <SegmentedControl
              size="sm"
              options={switchOptions}
              value={selectedBallType}
              onChange={setSelectedBallType}
              accessibilityLabel="Ball type"
            />
          </View>
        ) : null}
      </View>
      <StatTile items={performanceItems(stats)} />
    </View>
  );
}
