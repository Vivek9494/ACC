import {
  formatGroupDeleteBlockedMessage,
  type GroupSummary,
} from '@acc/types';

/** Resolve live match count from API fields (handles stale payloads missing liveMatchCount). */
export function resolveGroupLiveMatchCount(group: GroupSummary): number {
  if (typeof group.liveMatchCount === 'number') {
    return group.liveMatchCount;
  }
  return group.hasLiveMatches ? 1 : 0;
}

export function groupDeleteBlockedMessage(group: GroupSummary): string {
  return formatGroupDeleteBlockedMessage(resolveGroupLiveMatchCount(group));
}
