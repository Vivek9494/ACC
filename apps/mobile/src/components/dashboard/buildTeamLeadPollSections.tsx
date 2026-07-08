import type {
  CaptainScorerAssignmentMatch,
  CaptainUpcomingMatchCardView,
  ParticipationPollCardView,
} from '@acc/types';
import type { ReactNode } from 'react';

import { CaptainUpcomingMatchCard } from './CaptainUpcomingMatchCard';
import { ParticipationPollCard } from './ParticipationPollCard';

/** Captain/VC participation poll cards shared by captain and club-manager dashboards. */
export function buildTeamLeadPollSections(
  upcomingMatchCard: CaptainUpcomingMatchCardView | null,
  participationPoll: ParticipationPollCardView | null,
  onOpenScorerAssignment?: (match: CaptainScorerAssignmentMatch) => void,
  onPollUpdated?: () => void,
): ReactNode[] {
  return [
    upcomingMatchCard ? (
      <CaptainUpcomingMatchCard
        key="upcoming-match-card"
        card={upcomingMatchCard}
        onOpenScorerAssignment={onOpenScorerAssignment}
        onPollUpdated={onPollUpdated}
      />
    ) : null,
    participationPoll?.isOpen ? (
      <ParticipationPollCard
        key="participation-poll"
        poll={participationPoll}
        onPollUpdated={() => onPollUpdated?.()}
      />
    ) : null,
  ].filter((section) => section !== null);
}
