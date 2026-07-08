import type { ReactNode } from 'react';

import type { ActiveBroadcast } from '@acc/types';

import { BroadcastBanner } from '../components/dashboard/BroadcastBanner';

/** Prepends the broadcast banner when a message is active. */
export function prependBroadcastSection(
  sections: ReactNode[],
  broadcast: ActiveBroadcast | null,
): ReactNode[] {
  if (!broadcast) {
    return sections;
  }
  return [<BroadcastBanner key="broadcast" broadcast={broadcast} />, ...sections];
}
