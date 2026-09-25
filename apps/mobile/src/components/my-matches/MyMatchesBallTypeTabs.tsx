import { BallType, type BallType as BallTypeValue } from '@acc/types';

import { BallTypeSwitch } from '../ui/BallTypeSwitch';

export interface MyMatchesBallTypeTabsProps {
  ballTypes: readonly BallTypeValue[];
  selected: BallTypeValue;
  onSelect: (ballType: BallTypeValue) => void;
}

/**
 * Leather ↔ tennis sliding switch — only rendered when the user has matches in both
 * ball types ({@link MyMatchesScreen} gates on length &gt; 1).
 */
export function MyMatchesBallTypeTabs({
  selected,
  onSelect,
}: MyMatchesBallTypeTabsProps): React.ReactElement {
  return (
    <BallTypeSwitch
      value={selected === BallType.Tennis ? BallType.Tennis : BallType.Leather}
      onChange={onSelect}
      accessibilityLabel="Ball type"
    />
  );
}
