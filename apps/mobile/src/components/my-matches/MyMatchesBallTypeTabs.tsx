import { MY_MATCHES_BALL_TYPE_LABEL, BallType, type BallType as BallTypeValue } from '@acc/types';

import { PillTabBar } from '../ui/PillTabBar';

const TAB_ORDER: BallTypeValue[] = [BallType.Leather, BallType.Tennis];

export interface MyMatchesBallTypeTabsProps {
  ballTypes: readonly BallTypeValue[];
  selected: BallTypeValue;
  onSelect: (ballType: BallTypeValue) => void;
}

/** Leather / Tennis tabs — only rendered when the user has matches in both ball types. */
export function MyMatchesBallTypeTabs({
  ballTypes,
  selected,
  onSelect,
}: MyMatchesBallTypeTabsProps): React.ReactElement {
  const ordered = TAB_ORDER.filter((ballType) => ballTypes.includes(ballType));

  return (
    <PillTabBar
      accessibilityLabel="Ball type"
      value={selected}
      onChange={onSelect}
      options={ordered.map((ballType) => ({
        value: ballType,
        label: MY_MATCHES_BALL_TYPE_LABEL[ballType],
      }))}
    />
  );
}
