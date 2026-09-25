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

import { BallTypeSwitch } from '../ui/BallTypeSwitch';
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
 * Shows the leather↔tennis sliding switch only when the user has played both formats.
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
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Text variant="section" className="min-w-0 shrink font-sans-bold text-on-surface">
          Your Performance
        </Text>
        {showSwitch ? (
          <View className="shrink-0">
            <BallTypeSwitch value={selectedBallType} onChange={setSelectedBallType} />
          </View>
        ) : null}
      </View>
      <StatTile items={performanceItems(stats)} />
    </View>
  );
}
