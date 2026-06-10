import { BallType, type BallType as BallTypeValue } from '@acc/types';
import { Image } from 'react-native';

const TENNIS_BALL = require('../../../assets/icons/tennis-ball.png') as number;
const LEATHER_BALL = require('../../../assets/icons/leather-ball.png') as number;

const BALL_SOURCES: Record<BallTypeValue, { source: number; defaultLabel: string }> = {
  [BallType.Tennis]: {
    source: TENNIS_BALL,
    defaultLabel: 'Tennis ball tournament',
  },
  [BallType.Leather]: {
    source: LEATHER_BALL,
    defaultLabel: 'Leather ball tournament',
  },
};

export interface BallTypeIconProps {
  ballType?: BallTypeValue | null;
  /** Square edge length in px. Default 24. */
  size?: number;
  accessibilityLabel?: string;
}

/** Renders the tennis or leather ball PNG for a tournament's ball type (§6.1). */
export function BallTypeIcon({
  ballType,
  size = 24,
  accessibilityLabel,
}: BallTypeIconProps): React.ReactElement | null {
  if (!ballType) {
    return null;
  }

  const config = BALL_SOURCES[ballType];
  if (!config) {
    return null;
  }

  return (
    <Image
      source={config.source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? config.defaultLabel}
    />
  );
}
