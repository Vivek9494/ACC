import {
  BallType,
  canSelfRegisterForTournament,
  RegistrationStatus,
  TOURNAMENT_REGISTRATION_STATUS_INDICATOR_LABELS,
  type RegistrationStatus as RegistrationStatusType,
  type TournamentDetail,
  type UserRole,
} from '@acc/types';

export type RegistrationStatusIndicatorVariant = 'waitlist' | 'confirmed' | 'declined';

export type RegistrationCtaState =
  | { kind: 'hidden' }
  | { kind: 'active'; label: 'Registration' }
  | { kind: 'disabled'; label: string; reason: string }
  | { kind: 'status'; label: string; variant: RegistrationStatusIndicatorVariant };

export interface RegistrationCtaInput {
  tournament: Pick<
    TournamentDetail,
    | 'hasRegistrationWindow'
    | 'registrationIsOpen'
    | 'registrationOpenAt'
    | 'registrationCloseAt'
    | 'ballType'
  >;
  isAuthenticated: boolean;
  userRole: UserRole | null | undefined;
  registrationStatus: RegistrationStatusType | null;
  /** Leather only — from tournament detail API. */
  leatherRegistrationEligible?: boolean;
  formatOpensLabel: (iso: string) => string;
}

const STATUS_VARIANT: Record<
  RegistrationStatusType,
  RegistrationStatusIndicatorVariant
> = {
  [RegistrationStatus.InWaitlist]: 'waitlist',
  [RegistrationStatus.Confirmed]: 'confirmed',
  [RegistrationStatus.Declined]: 'declined',
};

function registeredStatusCta(
  status: RegistrationStatusType,
): RegistrationCtaState {
  return {
    kind: 'status',
    label: TOURNAMENT_REGISTRATION_STATUS_INDICATOR_LABELS[status],
    variant: STATUS_VARIANT[status],
  };
}

/** Resolve the bottom Registration CTA for the tournament details screen. */
export function resolveRegistrationCta(input: RegistrationCtaInput): RegistrationCtaState {
  const {
    tournament,
    isAuthenticated,
    userRole,
    registrationStatus,
    leatherRegistrationEligible,
    formatOpensLabel,
  } = input;

  if (!tournament.hasRegistrationWindow) {
    return { kind: 'hidden' };
  }

  if (!isAuthenticated || !canSelfRegisterForTournament(userRole)) {
    return { kind: 'hidden' };
  }

  if (
    tournament.ballType === BallType.Leather &&
    leatherRegistrationEligible === false
  ) {
    return { kind: 'hidden' };
  }

  if (registrationStatus === RegistrationStatus.InWaitlist) {
    return registeredStatusCta(registrationStatus);
  }

  if (registrationStatus === RegistrationStatus.Confirmed) {
    return registeredStatusCta(registrationStatus);
  }

  if (registrationStatus === RegistrationStatus.Declined) {
    return registeredStatusCta(registrationStatus);
  }

  if (tournament.registrationIsOpen) {
    return { kind: 'active', label: 'Registration' };
  }

  const now = Date.now();
  const openAt = tournament.registrationOpenAt
    ? new Date(tournament.registrationOpenAt).getTime()
    : null;
  const closeAt = tournament.registrationCloseAt
    ? new Date(tournament.registrationCloseAt).getTime()
    : null;

  if (openAt != null && now < openAt) {
    return {
      kind: 'disabled',
      label: 'Registration',
      reason: `Registration opens ${formatOpensLabel(tournament.registrationOpenAt as string)}`,
    };
  }

  if (closeAt != null && now > closeAt) {
    return { kind: 'hidden' };
  }

  return { kind: 'disabled', label: 'Registration', reason: 'Registration is not open' };
}
