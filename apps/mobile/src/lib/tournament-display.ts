import { TournamentState, type TournamentSummary } from '@acc/types';

import type { StatusPillVariant } from '../components/ui/StatusPill';

export function tournamentStatusPill(state: TournamentState): {
  variant: StatusPillVariant;
  label: string;
} {
  if (state === TournamentState.Completed) {
    return { variant: 'completed', label: 'Completed' };
  }
  if (state === TournamentState.Live || state === TournamentState.Knockout) {
    return { variant: 'ongoing', label: 'Ongoing' };
  }
  return { variant: 'upcoming', label: 'Upcoming' };
}

export function formatTournamentDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (sameMonth) {
    return `${startLabel} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${startLabel} – ${endLabel}`;
}

export function tournamentLocation(tournament: TournamentSummary): string {
  return tournament.location?.trim() || 'Location TBD';
}
