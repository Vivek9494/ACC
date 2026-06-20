import { useLocalSearchParams } from 'expo-router';

import {
  parseBatsmanPickerRole,
  SelectBatsmanScreen,
} from '../../../src/components/scoring/SelectBatsmanScreen';
import type { IncomingCreaseSlot } from '../../../src/lib/scoring-pick-session';

export default function SelectBatsmanRoute(): React.ReactElement {
  const { matchId, inningsId, role, otherSlotUserId, incomingSlot } = useLocalSearchParams<{
    matchId: string;
    inningsId: string;
    role?: string;
    otherSlotUserId?: string;
    incomingSlot?: IncomingCreaseSlot;
  }>();

  return (
    <SelectBatsmanScreen
      matchId={matchId}
      inningsId={inningsId}
      role={parseBatsmanPickerRole(role)}
      otherSlotUserId={otherSlotUserId ?? null}
      incomingSlot={incomingSlot ?? null}
    />
  );
}
