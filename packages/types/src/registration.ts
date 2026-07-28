/**
 * Player registration contracts shared between the api and mobile (spec §7).
 * Single source of truth for the §7.1 default form fields, the §7.3 status
 * lifecycle, §7.5 ratings/availability, and the §7.2/§21 custom-form shapes.
 */

/** Batting style (spec §7.1). */
export const BattingStyle = {
  RHB: 'RHB',
  LHB: 'LHB',
} as const;
export type BattingStyle = (typeof BattingStyle)[keyof typeof BattingStyle];

export const BATTING_STYLE_LABELS: Record<BattingStyle, string> = {
  RHB: 'Right Hand (RHB/RHB)',
  LHB: 'Left Hand (LHB/LAB)',
};

/** Short hand label for live scoring picker rows (matches design copy). */
export const BATTING_HAND_LABELS: Record<BattingStyle, string> = {
  RHB: 'Right Hand Batsman',
  LHB: 'Left Hand Batsman',
};

/** Bowling style (spec §7.1). */
export const BowlingStyle = {
  PACE: 'PACE',
  SPIN: 'SPIN',
} as const;
export type BowlingStyle = (typeof BowlingStyle)[keyof typeof BowlingStyle];

export const BOWLING_STYLE_LABELS: Record<BowlingStyle, string> = {
  PACE: 'Pace',
  SPIN: 'Spin',
};

/** Self-reported primary role at registration (§7.1 form). */
export const PlayerRegistrationRole = {
  Batsman: 'BATSMAN',
  Bowler: 'BOWLER',
  AllRounder: 'ALL_ROUNDER',
} as const;
export type PlayerRegistrationRole =
  (typeof PlayerRegistrationRole)[keyof typeof PlayerRegistrationRole];

export const PLAYER_REGISTRATION_ROLE_LABELS: Record<PlayerRegistrationRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
};

export const BATTING_POSITION_OPTIONS = [
  'Opener',
  'Middle Order',
  'Finisher',
  'Tail-ender',
] as const;
export type BattingPositionOption = (typeof BATTING_POSITION_OPTIONS)[number];

export const BOWLING_TYPE_OPTIONS = ['Fast', 'Medium', 'Leg Spin', 'Off Spin'] as const;
export type BowlingTypeOption = (typeof BOWLING_TYPE_OPTIONS)[number];

/** Display labels for bowling types on live scoring picker rows. */
export const BOWLING_TYPE_DISPLAY_LABELS: Record<BowlingTypeOption, string> = {
  Fast: 'Fast Bowler',
  Medium: 'Medium Fast',
  'Leg Spin': 'Leg Spinner',
  'Off Spin': 'Off Spinner',
};

/** Maps a stored bowling type to a picker label; falls back to "Bowler". */
export function bowlingTypeDisplayLabel(type: string | null | undefined): string {
  if (!type) return 'Bowler';
  const labels = BOWLING_TYPE_DISPLAY_LABELS as Record<string, string>;
  return labels[type] ?? type;
}

/** Short Left/Right label from stored batting style (RHB/LHB). */
export function registrationBattingHandShortLabel(
  battingStyle: BattingStyle | null | undefined,
): string | null {
  if (battingStyle === BattingStyle.RHB) {
    return 'Right';
  }
  if (battingStyle === BattingStyle.LHB) {
    return 'Left';
  }
  return null;
}

/** Display label for self-reported registration role (§7.1). */
export function registrationPlayerRoleLabel(
  playerRole: PlayerRegistrationRole | null | undefined,
): string | null {
  if (!playerRole) {
    return null;
  }
  return PLAYER_REGISTRATION_ROLE_LABELS[playerRole];
}

/**
 * Read-only chip labels for the registration form's "Skill Assessment" section (§7.1).
 * Stored as separate scalar columns on the tournament Registration row — not a multi-select.
 */
export function buildRegistrationSkillAssessmentChipLabels(
  registration: Pick<
    RegistrationSummary,
    | 'battingRating'
    | 'battingPosition'
    | 'bowlingRating'
    | 'bowlingType'
    | 'fieldingRating'
    | 'fieldingPosition'
  >,
): string[] {
  const chips: string[] = [];

  if (registration.battingRating != null) {
    chips.push(`Batting · ${formatRegistrationSkillRating(registration.battingRating)}`);
  }
  if (registration.battingPosition) {
    chips.push(registration.battingPosition);
  }
  if (registration.bowlingRating != null) {
    chips.push(`Bowling · ${formatRegistrationSkillRating(registration.bowlingRating)}`);
  }
  if (registration.bowlingType) {
    chips.push(registration.bowlingType);
  }
  if (registration.fieldingRating != null) {
    chips.push(`Fielding · ${formatRegistrationSkillRating(registration.fieldingRating)}`);
  }
  if (registration.fieldingPosition) {
    chips.push(registration.fieldingPosition);
  }

  return chips;
}

/** Poll Results row subtitle from per-tournament registration (§7.1). */
export function formatPollPlayerSkillLabel(input: {
  battingPosition: string | null;
  fieldingPosition: string | null;
  bowlingType: string | null;
  playerRole: PlayerRegistrationRole | null;
}): string | null {
  if (input.fieldingPosition === 'Wicketkeeper') {
    return 'Wicket Keeper';
  }
  if (input.battingPosition === 'Opener') {
    return 'Opening Batsman';
  }
  if (input.battingPosition) {
    return input.battingPosition;
  }
  if (input.bowlingType) {
    return bowlingTypeDisplayLabel(input.bowlingType);
  }
  if (input.playerRole === PlayerRegistrationRole.AllRounder) {
    return 'All-rounder';
  }
  if (input.playerRole === PlayerRegistrationRole.Batsman) {
    return 'Batsman';
  }
  if (input.playerRole === PlayerRegistrationRole.Bowler) {
    return 'Bowler';
  }
  return null;
}

export const FIELDING_POSITION_OPTIONS = [
  'Slips',
  'Inner Circle',
  'Outfield',
  'Wicketkeeper',
] as const;
export type FieldingPositionOption = (typeof FIELDING_POSITION_OPTIONS)[number];

/** Skill ratings (§7.1 / §7.5): whole numbers 0–10 for BAT / BOWL / FIELD. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;

/** Select options for registration and verification rating inputs (0–10 integers). */
export const REGISTRATION_RATING_OPTIONS: readonly { value: number; label: string }[] =
  Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, index) => {
    const value = RATING_MIN + index;
    return { value, label: String(value) };
  });

/** @deprecated Use {@link REGISTRATION_RATING_OPTIONS}. */
export const REGISTRATION_SKILL_RATING_OPTIONS = REGISTRATION_RATING_OPTIONS;

/** @deprecated Use {@link REGISTRATION_RATING_OPTIONS}. */
export const REGISTRATION_FIELDING_RATING_OPTIONS = REGISTRATION_RATING_OPTIONS;

/** Allowed stored values for batting/bowling ratings. */
export const REGISTRATION_SKILL_RATING_VALUES: readonly number[] =
  REGISTRATION_RATING_OPTIONS.map((option) => option.value);

/** Allowed stored values for fielding ratings. */
export const REGISTRATION_FIELDING_RATING_VALUES: readonly number[] =
  REGISTRATION_RATING_OPTIONS.map((option) => option.value);

/** Display a registration skill rating (integer 0–10, no decimals). */
export function formatRegistrationSkillRating(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return String(Math.trunc(value));
}

/** True when a value is a valid stored registration skill rating. */
export function isValidRegistrationSkillRating(value: number): boolean {
  return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}
export const RegistrationPlayerType = {
  FullTime: 'FULL_TIME',
  PartTime: 'PART_TIME',
} as const;
export type RegistrationPlayerType =
  (typeof RegistrationPlayerType)[keyof typeof RegistrationPlayerType];

export const REGISTRATION_PLAYER_TYPE_OPTIONS: readonly {
  value: RegistrationPlayerType;
  label: string;
}[] = [
  { value: RegistrationPlayerType.FullTime, label: 'Full-time Player' },
  { value: RegistrationPlayerType.PartTime, label: 'Part-time Player' },
] as const;

export const REGISTRATION_PLAYER_TYPE_LABELS: Record<RegistrationPlayerType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
};

/** Confirm Playing 11 subtitle — part-timers include locked-XI match count. */
export function formatRegistrationPlayerTypeLine(
  playerType: RegistrationPlayerType | null | undefined,
  matchesPlayedCount?: number | null,
): string | null {
  if (!playerType) {
    return null;
  }
  const label = REGISTRATION_PLAYER_TYPE_LABELS[playerType];
  if (playerType === RegistrationPlayerType.PartTime && matchesPlayedCount != null) {
    return `${label} · Matches - ${matchesPlayedCount}`;
  }
  return label;
}

/** Maps detailed bowling type to coarse {@link BowlingStyle} for legacy queries. */
export function bowlingStyleFromType(type: string | null | undefined): BowlingStyle | null {
  if (!type) {
    return null;
  }
  const normalized = type.trim().toLowerCase();
  if (normalized === 'fast' || normalized === 'medium') {
    return BowlingStyle.PACE;
  }
  if (normalized === 'leg spin' || normalized === 'off spin') {
    return BowlingStyle.SPIN;
  }
  return null;
}

/** Registration status lifecycle (spec §7.3). */
export const RegistrationStatus = {
  InWaitlist: 'IN_WAITLIST',
  Confirmed: 'CONFIRMED',
  Declined: 'DECLINED',
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  IN_WAITLIST: 'In Waitlist',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
};

/** Labels for the non-interactive status indicator on tournament details. */
export const TOURNAMENT_REGISTRATION_STATUS_INDICATOR_LABELS: Record<RegistrationStatus, string> = {
  IN_WAITLIST: 'In Waitlist',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Registration Declined',
};

/**
 * Exact text shown to a player when their registration is declined (spec §7.3).
 */
export const REGISTRATION_DECLINED_MESSAGE = 'Declined. Contact Center Sevak';

/** Custom registration field type (spec §7.2, §21). */
export const RegistrationFieldType = {
  Text: 'TEXT',
  Number: 'NUMBER',
  Select: 'SELECT',
  Boolean: 'BOOLEAN',
} as const;
export type RegistrationFieldType =
  (typeof RegistrationFieldType)[keyof typeof RegistrationFieldType];

/** Status of an organizer's custom-form request (spec §7.2). */
export const CustomFormRequestStatus = {
  Pending: 'PENDING',
  Fulfilled: 'FULFILLED',
  Declined: 'DECLINED',
} as const;
export type CustomFormRequestStatus =
  (typeof CustomFormRequestStatus)[keyof typeof CustomFormRequestStatus];

// --- Custom form definitions (§7.2, §21) -----------------------------------

/** A tournament-scoped custom field definition built by Admin. */
export interface RegistrationFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: RegistrationFieldType;
  required: boolean;
  /** Choices for a SELECT field. */
  options: string[] | null;
  position: number;
}

/** Input shape Admin posts when building/replacing a tournament's custom form. */
export interface RegistrationFieldDefinitionInput {
  key: string;
  label: string;
  fieldType: RegistrationFieldType;
  required?: boolean;
  options?: string[] | null;
  position?: number;
}

export interface BuildCustomFormRequest {
  fields: RegistrationFieldDefinitionInput[];
}

/** Organizer's request to Admin to add/modify fields (§7.2). */
export interface CreateCustomFormRequest {
  note?: string | null;
  requestedFields?: RegistrationFieldDefinitionInput[] | null;
}

export interface CustomFormRequestSummary {
  id: string;
  tournamentId: string;
  requestedByUserId: string;
  note: string | null;
  requestedFields: RegistrationFieldDefinitionInput[] | null;
  status: CustomFormRequestStatus;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// --- Registration submission & review --------------------------------------

/**
 * Default §7.1 registration form payload. Phone is taken from the authenticated
 * user's profile. Name and Center may be updated here when the player edits them
 * on the form. Ratings are stored on the registration row and may be overwritten
 * later by the Center Sevak after the window closes (§7.5); audit log retains history.
 */
export interface SubmitRegistrationRequest {
  firstName: string;
  lastName: string;
  centerId: string;
  battingStyle?: BattingStyle | null;
  playerRole?: PlayerRegistrationRole | null;
  battingRating?: number | null;
  battingPosition?: string | null;
  bowlingStyle?: BowlingStyle | null;
  bowlingType?: string | null;
  bowlingRating?: number | null;
  fieldingRating?: number | null;
  fieldingPosition?: string | null;
  /** Required for leather-ball tournaments; omitted/null for tennis. */
  playerType?: RegistrationPlayerType | null;
  /** Answers to the tournament's custom fields, keyed by field `key` (§7.2). */
  customFields?: Record<string, unknown> | null;
}

/**
 * Late registration of a player who missed the deadline (§7.6). Only Organizer
 * and Center Sevak may call this; `userId` is the player being registered.
 */
export interface LateRegistrationRequest extends SubmitRegistrationRequest {
  userId: string;
}

/** Center Sevak rating update after the registration window closes (§7.5). Overwrites the single rating field. */
export interface UpdateRatingsRequest {
  battingRating?: number | null;
  bowlingRating?: number | null;
  fieldingRating?: number | null;
  /** Leather-ball only — Center Sevak may correct player type post-window. */
  playerType?: RegistrationPlayerType | null;
}

/** Center Sevak availability record for a player (§7.5, APL only). */
export interface UpdateAvailabilityRequest {
  isAvailable: boolean;
  availabilityNote?: string | null;
}

// --- Read projections -------------------------------------------------------

/** A registration row as seen in lists/queues (§7.3, §7.4). */
export interface RegistrationSummary {
  id: string;
  tournamentId: string;
  userId: string;
  centerId: string;
  centerName: string;
  status: RegistrationStatus;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  profilePhotoUrl: string | null;
  battingStyle: BattingStyle | null;
  battingRating: number | null;
  battingPosition: string | null;
  playerRole: PlayerRegistrationRole | null;
  bowlingStyle: BowlingStyle | null;
  bowlingType: string | null;
  bowlingRating: number | null;
  fieldingRating: number | null;
  fieldingPosition: string | null;
  playerType: RegistrationPlayerType | null;
  isAvailable: boolean | null;
  availabilityNote: string | null;
  createdAt: string;
}

/** Full registration detail, including the answered custom fields. */
export interface RegistrationDetail extends RegistrationSummary {
  customFields: Record<string, unknown> | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
}

/** Aggregate availability for the §7.5 bar-chart (APL). */
export interface AvailabilitySummary {
  available: number;
  unavailable: number;
  /** Confirmed players the Center Sevak has not yet contacted. */
  pending: number;
  total: number;
}

/** Center Sevak verification queue for a tournament (§7.3, §7.4). */
export const RegistrationVerificationPhase = {
  /** Registration window open — view-only roster. */
  ViewOnly: 'VIEW_ONLY',
  /** Registration window closed — ratings + approve/decline. */
  Manage: 'MANAGE',
} as const;
export type RegistrationVerificationPhase =
  (typeof RegistrationVerificationPhase)[keyof typeof RegistrationVerificationPhase];

/** Center player who has not registered for the tournament yet. */
export interface CenterPlayerRosterEntry {
  userId: string;
  centerId: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  profilePhotoUrl: string | null;
}

/** Center Sevak roster + verification state for a tournament (§7.3, §7.4). */
export interface RegistrationVerificationQueue {
  phase: RegistrationVerificationPhase;
  /**
   * Button count for the current phase. Hide the Verify Players button when 0.
   * VIEW_ONLY: registered count. MANAGE: In Waitlist pending verification only
   * (Sevak late-confirmed registrations are excluded).
   */
  actionCount: number;
  /** Own-center registrations with submitted details. */
  registered: RegistrationSummary[];
  /** Own-center players (profile center) without a registration row. */
  notRegistered: CenterPlayerRosterEntry[];
  /** Count shown in the screen subtitle. */
  registeredCount: number;
  /** Ratings edit + approve/decline allowed (post-window only). */
  canManage: boolean;
  /**
   * §7.6: Actor may late-register a missed player (Admin / Club Manager / eligible
   * Center Sevak). Independent of the registration window.
   */
  canLateRegister: boolean;
}

/** Per-team shared shortlist (auction prep) — Captain + Vice-Captain of the same team. */
export interface TournamentFavouritePlayersView {
  favourites: VerifiedRegisteredPlayerRow[];
  /** True when the actor may toggle hearts (Captain / VC, incl. Club Manager on a team). */
  canFavourite: boolean;
  favouriteTeamId: string | null;
}

/** Verified registrant row on the Registered Players List (tennis scouting). */
export interface VerifiedRegisteredPlayerRow extends RegistrationSummary {
  isFavourited: boolean;
  /** True when the player uploaded a READY skill video for this tournament. */
  hasSkillVideo: boolean;
  skillVideoId: string | null;
}

export interface VerifiedRegisteredPlayersView {
  /**
   * Confirmed registrants (same as {@link confirmed}). Kept for callers that
   * still read `players` after the three-tab Registered Players list shipped.
   */
  players: VerifiedRegisteredPlayerRow[];
  waitlist: VerifiedRegisteredPlayerRow[];
  confirmed: VerifiedRegisteredPlayerRow[];
  declined: VerifiedRegisteredPlayerRow[];
  canFavourite: boolean;
  favouriteTeamId: string | null;
  /** §7.6 late-add escape hatch on the Registered Players list. */
  canLateRegister: boolean;
}

/** Leather ACC registrants — Admin / Club Manager squad-building list. */
export interface LeatherRegisteredPlayersView {
  players: RegistrationSummary[];
  totalCount: number;
  /** §7.6 late-add escape hatch on the Registered Players list. */
  canLateRegister: boolean;
}

/** Players eligible for §7.6 late registration (picker). */
export interface LateRegisterCandidatesView {
  players: CenterPlayerRosterEntry[];
}

export interface ListLeatherRegisteredPlayersQuery {
  search?: string;
  page?: number;
  limit?: number;
}

export interface SetRegistrationFavouriteRequest {
  favourited: boolean;
}

export interface SetRegistrationFavouriteResponse {
  userId: string;
  isFavourited: boolean;
}

/** Skill/role chips on the Registered Players List (tennis scouting). */
export const VerifiedPlayerSkillFilter = {
  All: 'ALL',
  Batsman: 'BATSMAN',
  Bowler: 'BOWLER',
  AllRounder: 'ALL_ROUNDER',
  Wicketkeeper: 'WICKETKEEPER',
} as const;
export type VerifiedPlayerSkillFilter =
  (typeof VerifiedPlayerSkillFilter)[keyof typeof VerifiedPlayerSkillFilter];

export const VERIFIED_PLAYER_SKILL_FILTER_ORDER: VerifiedPlayerSkillFilter[] = [
  VerifiedPlayerSkillFilter.All,
  VerifiedPlayerSkillFilter.Batsman,
  VerifiedPlayerSkillFilter.Bowler,
  VerifiedPlayerSkillFilter.AllRounder,
  VerifiedPlayerSkillFilter.Wicketkeeper,
];

export const VERIFIED_PLAYER_SKILL_FILTER_LABELS: Record<VerifiedPlayerSkillFilter, string> = {
  ALL: 'All Players',
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-Rounder',
  WICKETKEEPER: 'Wicketkeeper',
};

/**
 * Role filter for verified registrants. Wicketkeeper uses `fieldingPosition`;
 * Batsman / Bowler / All-Rounder use registration `playerRole` (§7.1).
 */
export function matchesVerifiedPlayerSkillFilter(
  player: Pick<RegistrationSummary, 'playerRole' | 'fieldingPosition'>,
  filter: VerifiedPlayerSkillFilter,
): boolean {
  if (filter === VerifiedPlayerSkillFilter.All) {
    return true;
  }
  if (filter === VerifiedPlayerSkillFilter.Wicketkeeper) {
    return player.fieldingPosition === 'Wicketkeeper';
  }
  return player.playerRole === filter;
}

function registrationDisplayName(
  player: Pick<RegistrationSummary, 'firstName' | 'lastName'>,
): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

/**
 * Compare by a stored skill rating (DESC). Null/unset ratings sort last; equal
 * ratings tie-break alphabetically by name.
 */
export function compareByRegistrationSkillRatingDesc(
  a: Pick<RegistrationSummary, 'firstName' | 'lastName'> & {
    rating: number | null;
  },
  b: Pick<RegistrationSummary, 'firstName' | 'lastName'> & {
    rating: number | null;
  },
): number {
  const byName = registrationDisplayName(a).localeCompare(registrationDisplayName(b));
  if (a.rating === null && b.rating === null) {
    return byName;
  }
  if (a.rating === null) {
    return 1;
  }
  if (b.rating === null) {
    return -1;
  }
  return b.rating - a.rating || byName;
}

/**
 * Ordering for the verified Registered Players list after a skill chip is applied.
 * Batsman → battingRating DESC; Bowler → bowlingRating DESC; other chips → name.
 */
export function compareVerifiedPlayersForSkillFilter(
  a: Pick<
    RegistrationSummary,
    'firstName' | 'lastName' | 'battingRating' | 'bowlingRating'
  >,
  b: Pick<
    RegistrationSummary,
    'firstName' | 'lastName' | 'battingRating' | 'bowlingRating'
  >,
  filter: VerifiedPlayerSkillFilter,
): number {
  if (filter === VerifiedPlayerSkillFilter.Batsman) {
    return compareByRegistrationSkillRatingDesc(
      { ...a, rating: a.battingRating },
      { ...b, rating: b.battingRating },
    );
  }
  if (filter === VerifiedPlayerSkillFilter.Bowler) {
    return compareByRegistrationSkillRatingDesc(
      { ...a, rating: a.bowlingRating },
      { ...b, rating: b.bowlingRating },
    );
  }
  return registrationDisplayName(a).localeCompare(registrationDisplayName(b));
}

/** Sort keys for the registered-players list (§7.5). */
export const RegistrationSortKey = {
  Name: 'NAME',
  Batting: 'BATTING',
  Bowling: 'BOWLING',
  Fielding: 'FIELDING',
  Availability: 'AVAILABILITY',
} as const;
export type RegistrationSortKey =
  (typeof RegistrationSortKey)[keyof typeof RegistrationSortKey];
