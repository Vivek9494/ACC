import { CitySelection } from './rbac';
import type { TournamentScopeDisplay } from './tournament';

/** Full scope line for tournament details (from existing Tournament For + province/centers). */
export function formatTournamentScopeLine(scope: TournamentScopeDisplay): string | null {
  if (scope.citySelection === CitySelection.All) {
    const province = scope.provinceName?.trim();
    return province ? `${province} · All Centers` : 'All Centers';
  }

  if (scope.centerNames.length > 0) {
    return scope.centerNames.join(', ');
  }

  return scope.provinceName?.trim() ?? null;
}

/** Truncated scope line for dashboard cards with long center lists. */
export function formatTournamentScopeLineTruncated(
  scope: TournamentScopeDisplay,
  maxCenters = 2,
): string | null {
  if (scope.citySelection === CitySelection.All) {
    return formatTournamentScopeLine(scope);
  }

  if (scope.centerNames.length === 0) {
    return scope.provinceName?.trim() ?? null;
  }

  if (scope.centerNames.length <= maxCenters) {
    return scope.centerNames.join(', ');
  }

  const visible = scope.centerNames.slice(0, maxCenters).join(', ');
  const remaining = scope.centerNames.length - maxCenters;
  return `${visible}, +${remaining} more`;
}
