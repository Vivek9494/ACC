import {
  BallType,
  dashboardPlayedBallTypes,
  statsForDashboardBallType,
  type BallType as BallTypeValue,
  type DashboardPlayerPerformance,
  type ManagerPlayerStats,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { MyMatchesBallTypeTabs } from '../my-matches/MyMatchesBallTypeTabs';
import { StatTile } from '../ui/StatTile';
import { Text } from '../ui/Text';

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

  return (
    <View className="gap-3">
      <Text className="font-sans-bold text-xl text-on-surface">Your Performance</Text>
      {showSwitch ? (
        <MyMatchesBallTypeTabs
          ballTypes={playedBallTypes}
          selected={selectedBallType}
          onSelect={setSelectedBallType}
        />
      ) : null}
      <StatTile items={performanceItems(stats)} />
    </View>
  );
}
