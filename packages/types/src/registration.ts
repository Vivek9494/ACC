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

export const FIELDING_POSITION_OPTIONS = [
  'Slips',
  'Inner Circle',
  'Outfield',
  'Wicketkeeper',
] as const;
export type FieldingPositionOption = (typeof FIELDING_POSITION_OPTIONS)[number];

/** Skill rating labels shown on the registration form; stored as 0–5 integers. */
export const REGISTRATION_SKILL_RATING_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 5, label: 'Star' },
  { value: 4, label: 'A' },
  { value: 3, label: 'B' },
  { value: 2, label: 'C' },
];

export const REGISTRATION_FIELDING_RATING_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 5, label: 'Excellent' },
  { value: 3, label: 'Good' },
  { value: 1, label: 'Average' },
];

/** Allowed stored values for batting/bowling ratings (matches registration Select options). */
export const REGISTRATION_SKILL_RATING_VALUES: readonly number[] =
  REGISTRATION_SKILL_RATING_OPTIONS.map((option) => option.value);

/** Allowed stored values for fielding ratings (matches registration Select options). */
export const REGISTRATION_FIELDING_RATING_VALUES: readonly number[] =
  REGISTRATION_FIELDING_RATING_OPTIONS.map((option) => option.value);

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

/** Rating bounds for the §7.5 batting/bowling/fielding ratings (0–5). */
export const RATING_MIN = 0;
export const RATING_MAX = 5;

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
  /** §7.6: Center Sevak may late-register after tournament Registration Closed. */
  canLateRegister: boolean;
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
