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
  RHB: 'Right-hand bat',
  LHB: 'Left-hand bat',
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
 * Default §7.1 registration form payload. First/last name, phone and Center are
 * taken from the authenticated user's profile, so only the cricket attributes
 * plus any custom answers are submitted here.
 */
export interface SubmitRegistrationRequest {
  battingStyle?: BattingStyle | null;
  battingRating?: number | null;
  bowlingStyle?: BowlingStyle | null;
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

/** Center Sevak rating update for an own-Center player (§7.5, APL only). */
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
  bowlingStyle: BowlingStyle | null;
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
