/**
 * Authorization contracts (spec §1.1, §2 and the RBAC Permission Matrix
 * companion doc). This file is the single source of truth for the permission
 * matrix; the api evaluates it in `PermissionService` and mobile can reuse the
 * `Permission` keys for optimistic UI gating.
 */

import { UserRole } from './auth';

/** Resolved tournament type (spec §1, §1.1). */
export const TournamentType = {
  ACC: 'ACC',
  APL: 'APL',
  Center: 'CENTER',
} as const;
export type TournamentType = (typeof TournamentType)[keyof typeof TournamentType];

/** Ball type chosen on the Add Tournament form (spec §6.1); drives §1.1. */
export const BallType = {
  Leather: 'LEATHER',
  Tennis: 'TENNIS',
} as const;
export type BallType = (typeof BallType)[keyof typeof BallType];

/** City coverage option chosen at creation (spec §1.1). */
export const CitySelection = {
  /** Every city of the province participates. */
  All: 'ALL',
  /** More than one city, but not all. */
  Multi: 'MULTI',
  /** A single city. */
  Single: 'SINGLE',
} as const;
export type CitySelection = (typeof CitySelection)[keyof typeof CitySelection];

/**
 * Actions from the RBAC matrix that the api gates. Names mirror the matrix rows
 * (companion doc). Not every read-only/guest row is enumerated — only the
 * actions the backend must authorize.
 */
export const Permission = {
  // A. Account & Profile
  DEACTIVATE_PLAYER: 'DEACTIVATE_PLAYER',
  APPROVE_CENTER_MIGRATION: 'APPROVE_CENTER_MIGRATION',
  MANAGE_PROVINCES: 'MANAGE_PROVINCES',
  MANAGE_CENTERS: 'MANAGE_CENTERS',
  // B. Tournament Creation & Lifecycle
  CREATE_ACC_TOURNAMENT: 'CREATE_ACC_TOURNAMENT',
  CREATE_APL_TOURNAMENT: 'CREATE_APL_TOURNAMENT',
  CREATE_CENTER_TOURNAMENT: 'CREATE_CENTER_TOURNAMENT',
  EDIT_TOURNAMENT: 'EDIT_TOURNAMENT',
  CHANGE_TOURNAMENT_STATUS: 'CHANGE_TOURNAMENT_STATUS',
  CREATE_MATCH: 'CREATE_MATCH',
  BUILD_CUSTOM_FORM: 'BUILD_CUSTOM_FORM',
  // C. Player Registration & Approval
  SUBMIT_REGISTRATION: 'SUBMIT_REGISTRATION',
  APPROVE_REGISTRATION: 'APPROVE_REGISTRATION',
  VIEW_REGISTRATIONS_OWN_CENTER: 'VIEW_REGISTRATIONS_OWN_CENTER',
  VIEW_REGISTRATIONS_ALL_CENTERS: 'VIEW_REGISTRATIONS_ALL_CENTERS',
  UPDATE_PLAYER_RATINGS: 'UPDATE_PLAYER_RATINGS',
  UPDATE_PLAYER_AVAILABILITY: 'UPDATE_PLAYER_AVAILABILITY',
  VIEW_AVAILABILITY_CHART: 'VIEW_AVAILABILITY_CHART',
  REGISTER_LATE_PLAYER: 'REGISTER_LATE_PLAYER',
  REQUEST_CUSTOM_FORM: 'REQUEST_CUSTOM_FORM',
  // D. Teams & Roster
  ASSIGN_TEAM_ROLES: 'ASSIGN_TEAM_ROLES',
  ADD_PLAYER_TO_TEAM: 'ADD_PLAYER_TO_TEAM',
  REMOVE_PLAYER_FROM_TEAM: 'REMOVE_PLAYER_FROM_TEAM',
  RESHUFFLE_ACC_TEAMS: 'RESHUFFLE_ACC_TEAMS',
  MARK_IMPACT_PLAYER: 'MARK_IMPACT_PLAYER',
  FAVOURITE_PLAYERS: 'FAVOURITE_PLAYERS',
  ASSIGN_TOURNAMENT_SCORER: 'ASSIGN_TOURNAMENT_SCORER',
  // E. ACC Schedule & External Teams (ACC only)
  UPDATE_TEAM_SCHEDULE: 'UPDATE_TEAM_SCHEDULE',
  ENTER_EXTERNAL_PLAYERS: 'ENTER_EXTERNAL_PLAYERS',
  UPDATE_MATCH_STATUS: 'UPDATE_MATCH_STATUS',
  CANCEL_MATCH: 'CANCEL_MATCH',
  // F. Availability Polls & Playing 11 (ACC only)
  VOTE_AVAILABILITY_POLL: 'VOTE_AVAILABILITY_POLL',
  SELECT_PLAYING_11: 'SELECT_PLAYING_11',
  SWAP_SUBSTITUTE: 'SWAP_SUBSTITUTE',
  // G. Geofence Attendance & Suspension (ACC only)
  OVERRIDE_ARRIVAL_TIME: 'OVERRIDE_ARRIVAL_TIME',
  CANCEL_SUSPENSION: 'CANCEL_SUSPENSION',
  VIEW_OWN_SUSPENSION: 'VIEW_OWN_SUSPENSION',
  // H. Match Setup & Scorer Assignment
  ASSIGN_MATCH_SCORER: 'ASSIGN_MATCH_SCORER',
  GRANT_SCORER_TO_SUSPENDED: 'GRANT_SCORER_TO_SUSPENDED',
  REVOKE_SCORER: 'REVOKE_SCORER',
  RECORD_TOSS: 'RECORD_TOSS',
  START_MATCH: 'START_MATCH',
  // I. Ball-by-Ball Scoring
  SCORE_BALL: 'SCORE_BALL',
  EDIT_PREVIOUS_OVER: 'EDIT_PREVIOUS_OVER',
  ENTER_DLS_TARGET: 'ENTER_DLS_TARGET',
  BRING_IN_IMPACT_PLAYER: 'BRING_IN_IMPACT_PLAYER',
  COMPLETE_MATCH: 'COMPLETE_MATCH',
  // J. Scorecard Confirmation & Post-Match
  CONFIRM_SCORECARD: 'CONFIRM_SCORECARD',
  EDIT_SCORECARD_POST_CONFIRM: 'EDIT_SCORECARD_POST_CONFIRM',
  SELECT_MAN_OF_MATCH: 'SELECT_MAN_OF_MATCH',
  AWARD_MAN_OF_TOURNAMENT: 'AWARD_MAN_OF_TOURNAMENT',
  // K. Statistics
  VIEW_ALL_STATS_OWN_TEAM: 'VIEW_ALL_STATS_OWN_TEAM',
  VIEW_ALL_STATS_ALL_TEAMS: 'VIEW_ALL_STATS_ALL_TEAMS',
  // L. Fees & Videos
  UPDATE_FEES: 'UPDATE_FEES',
  VIEW_TEAM_FEES: 'VIEW_TEAM_FEES',
  UPLOAD_OWN_VIDEO: 'UPLOAD_OWN_VIDEO',
  VIEW_PLAYER_VIDEOS: 'VIEW_PLAYER_VIDEOS',
  // M. OTP Lockout & Recovery
  VIEW_LOCKED_ACCOUNTS_OWN_TEAM: 'VIEW_LOCKED_ACCOUNTS_OWN_TEAM',
  VIEW_LOCKED_ACCOUNTS_ALL: 'VIEW_LOCKED_ACCOUNTS_ALL',
  UNLOCK_ACCOUNT: 'UNLOCK_ACCOUNT',
  // N. Audit & Announcements
  VIEW_ADMIN_OVERVIEW: 'VIEW_ADMIN_OVERVIEW',
  VIEW_AUDIT_LOG: 'VIEW_AUDIT_LOG',
  SEND_ANNOUNCEMENT: 'SEND_ANNOUNCEMENT',
  ADD_YOUTUBE_URL: 'ADD_YOUTUBE_URL',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * The Scorer pseudo-subject: not a stored {@link UserRole} but a per-match grant
 * (§2, §11.1). A grant is checked from a `MatchScorerGrant` record at runtime.
 */
export const SCORER_SUBJECT = 'SCORER';

/** A matrix cell's subject — a stored role or the per-match Scorer grant. */
export type GrantSubject = UserRole | typeof SCORER_SUBJECT;

/**
 * Scope qualifier on a grant (encodes the matrix footnotes):
 * - `GLOBAL` — no contextual check (default).
 * - `ORGANIZER` — B1: actor must be the tournament's organizer.
 * - `OWN_CENTER` — C1: actor's Center must match the target's Center.
 * - `OWN_TEAM` — actor's captaincy/management is scoped to the target team.
 * - `SELF` — G1: actor may act only on their own record.
 */
export const PermissionScope = {
  Global: 'GLOBAL',
  Organizer: 'ORGANIZER',
  OwnCenter: 'OWN_CENTER',
  OwnTeam: 'OWN_TEAM',
  Self: 'SELF',
} as const;
export type PermissionScope = (typeof PermissionScope)[keyof typeof PermissionScope];

/** One granting cell of the matrix. */
export interface RoleGrant {
  subject: GrantSubject;
  /** Defaults to GLOBAL. */
  scope?: PermissionScope;
  /** Grant-level type restriction, e.g. Manager (D1) only in APL/Center. */
  tournamentTypes?: TournamentType[];
  /** E1: Vice Captain inherits this only while the Captain is suspended. */
  requiresCaptainSuspended?: boolean;
  /**
   * §31 #1 fallback: Club Manager assumes captaincy for a match only when BOTH
   * the Captain and Vice Captain of the team are suspended for it.
   */
  requiresLeadersSuspended?: boolean;
}

/** All grants for one action, plus any action-wide tournament-type restriction. */
export interface PermissionRule {
  /** Action-level restriction, e.g. ACC-only schedule/poll/geofence actions. */
  tournamentTypes?: TournamentType[];
  grants: RoleGrant[];
}

const R = UserRole;

/** Convenience: a Captain + (Vice Captain when captain suspended) own-team pair. */
function captainAndDeputy(scope: PermissionScope = PermissionScope.OwnTeam): RoleGrant[] {
  return [
    { subject: R.Captain, scope },
    { subject: R.ViceCaptain, scope, requiresCaptainSuspended: true },
  ];
}

const ACC_ONLY: TournamentType[] = [TournamentType.ACC];
const TENNIS_TYPES: TournamentType[] = [TournamentType.APL, TournamentType.Center];

/**
 * The RBAC matrix as data (companion doc). Admin is encoded per-cell rather than
 * auto-granted: a `—` in the Admin column is a deliberate scope decision (e.g.
 * Admin cannot "favourite players"), per the doc's cross-cutting note.
 */
export const PERMISSION_MATRIX: Record<Permission, PermissionRule> = {
  // A. Account & Profile
  [Permission.DEACTIVATE_PLAYER]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.APPROVE_CENTER_MIGRATION]: {
    grants: [{ subject: R.CenterSevak, scope: PermissionScope.OwnCenter }],
  },
  [Permission.MANAGE_PROVINCES]: {
    grants: [{ subject: R.Admin }],
  },
  [Permission.MANAGE_CENTERS]: {
    grants: [{ subject: R.Admin }],
  },

  // B. Tournament Creation & Lifecycle
  [Permission.CREATE_ACC_TOURNAMENT]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.CREATE_APL_TOURNAMENT]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.CREATE_CENTER_TOURNAMENT]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, { subject: R.CenterSevak }],
  },
  [Permission.EDIT_TOURNAMENT]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
  [Permission.CHANGE_TOURNAMENT_STATUS]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
  [Permission.CREATE_MATCH]: {
    // Organizer builds the fixture (§11, §27); Admin everywhere.
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
  [Permission.BUILD_CUSTOM_FORM]: {
    grants: [{ subject: R.Admin }],
  },

  // C. Player Registration & Approval
  [Permission.SUBMIT_REGISTRATION]: {
    // §7.3: any player submits their own registration (self-scope).
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.CenterSevak },
      { subject: R.Captain },
      { subject: R.ViceCaptain },
      { subject: R.Manager, tournamentTypes: TENNIS_TYPES },
      { subject: R.Player, scope: PermissionScope.Self },
    ],
  },
  [Permission.APPROVE_REGISTRATION]: {
    grants: [{ subject: R.Admin }, { subject: R.CenterSevak, scope: PermissionScope.OwnCenter }],
  },
  [Permission.VIEW_REGISTRATIONS_OWN_CENTER]: {
    grants: [{ subject: R.Admin }, { subject: R.CenterSevak, scope: PermissionScope.OwnCenter }],
  },
  [Permission.VIEW_REGISTRATIONS_ALL_CENTERS]: {
    tournamentTypes: [TournamentType.APL],
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.UPDATE_PLAYER_RATINGS]: {
    tournamentTypes: [TournamentType.APL],
    grants: [{ subject: R.Admin }, { subject: R.CenterSevak, scope: PermissionScope.OwnCenter }],
  },
  [Permission.UPDATE_PLAYER_AVAILABILITY]: {
    // §7.5: Center Sevak records availability for own-Center players (APL only).
    tournamentTypes: [TournamentType.APL],
    grants: [{ subject: R.Admin }, { subject: R.CenterSevak, scope: PermissionScope.OwnCenter }],
  },
  [Permission.VIEW_AVAILABILITY_CHART]: {
    // §7.5: organizer views the availability bar-chart (APL only).
    tournamentTypes: [TournamentType.APL],
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.CenterSevak, scope: PermissionScope.OwnCenter },
    ],
  },
  [Permission.REGISTER_LATE_PLAYER]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.OwnCenter },
    ],
  },
  [Permission.REQUEST_CUSTOM_FORM]: {
    // §7.2: organizer (Club Manager / Center Sevak) requests; Admin builds.
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },

  // D. Teams & Roster
  [Permission.ASSIGN_TEAM_ROLES]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
  [Permission.ADD_PLAYER_TO_TEAM]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      // D1: Manager only in APL / Center.
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },
  [Permission.REMOVE_PLAYER_FROM_TEAM]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },
  [Permission.RESHUFFLE_ACC_TEAMS]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.MARK_IMPACT_PLAYER]: {
    // Admin is `—` here per the matrix.
    grants: [{ subject: R.Captain, scope: PermissionScope.OwnTeam }],
  },
  [Permission.FAVOURITE_PLAYERS]: {
    // Admin/CM/CS are `—`; team-social feature.
    grants: [
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },
  [Permission.ASSIGN_TOURNAMENT_SCORER]: {
    // APL / Center only (§11.1).
    tournamentTypes: TENNIS_TYPES,
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },

  // E. ACC Schedule & External Teams (ACC only)
  [Permission.UPDATE_TEAM_SCHEDULE]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.ENTER_EXTERNAL_PLAYERS]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: SCORER_SUBJECT }],
  },
  // Match-state changes (Delayed / Rain Interrupted / No Result) apply to every
  // tournament type — the §5.2 states are universal, not ACC-only.
  [Permission.UPDATE_MATCH_STATUS]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      ...captainAndDeputy(),
      { subject: SCORER_SUBJECT },
    ],
  },
  [Permission.CANCEL_MATCH]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },

  // F. Availability Polls & Playing 11 (ACC only)
  [Permission.VOTE_AVAILABILITY_POLL]: {
    tournamentTypes: ACC_ONLY,
    grants: [
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Player, scope: PermissionScope.OwnTeam },
    ],
  },
  // Playing 11 lock + substitutions: the "Playing 11 Locked" state (§5.2) is
  // universal, so this is not ACC-only. Club Manager is the §31 #1 fallback when
  // both the Captain and Vice Captain are suspended for the match.
  [Permission.SELECT_PLAYING_11]: {
    grants: [...captainAndDeputy(), { subject: R.ClubManager, requiresLeadersSuspended: true }],
  },
  [Permission.SWAP_SUBSTITUTE]: {
    grants: [...captainAndDeputy(), { subject: R.ClubManager, requiresLeadersSuspended: true }],
  },

  // G. Geofence Attendance & Suspension (ACC only)
  [Permission.OVERRIDE_ARRIVAL_TIME]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.CANCEL_SUSPENSION]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.VIEW_OWN_SUSPENSION]: {
    // G1: any authenticated user, own record only.
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.CenterSevak },
      { subject: R.Captain },
      { subject: R.ViceCaptain },
      { subject: R.Manager, tournamentTypes: TENNIS_TYPES },
      { subject: R.Player, scope: PermissionScope.Self },
    ],
  },

  // H. Match Setup & Scorer Assignment
  [Permission.ASSIGN_MATCH_SCORER]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.GRANT_SCORER_TO_SUSPENDED]: {
    tournamentTypes: ACC_ONLY,
    grants: [...captainAndDeputy(), { subject: R.ClubManager, requiresLeadersSuspended: true }],
  },
  [Permission.REVOKE_SCORER]: {
    tournamentTypes: ACC_ONLY,
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.RECORD_TOSS]: {
    // H1: Captain / VC act with Scorer-level permission when scoring.
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.START_MATCH]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },

  // I. Ball-by-Ball Scoring
  [Permission.SCORE_BALL]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.EDIT_PREVIOUS_OVER]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.ENTER_DLS_TARGET]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.BRING_IN_IMPACT_PLAYER]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.COMPLETE_MATCH]: {
    grants: [
      { subject: SCORER_SUBJECT },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
    ],
  },

  // J. Scorecard Confirmation & Post-Match
  [Permission.CONFIRM_SCORECARD]: {
    grants: [
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      // §31 #1: Club Manager confirms when both leaders are suspended.
      { subject: R.ClubManager, requiresLeadersSuspended: true },
    ],
  },
  [Permission.EDIT_SCORECARD_POST_CONFIRM]: {
    // ACC: Admin + Club Manager. APL/Center: Admin only (§13.2).
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, tournamentTypes: ACC_ONLY },
    ],
  },
  [Permission.SELECT_MAN_OF_MATCH]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }, ...captainAndDeputy()],
  },
  [Permission.AWARD_MAN_OF_TOURNAMENT]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },

  // K. Statistics
  [Permission.VIEW_ALL_STATS_OWN_TEAM]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },
  [Permission.VIEW_ALL_STATS_ALL_TEAMS]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },

  // L. Fees & Videos
  [Permission.UPDATE_FEES]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.VIEW_TEAM_FEES]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },
  [Permission.UPLOAD_OWN_VIDEO]: {
    grants: [{ subject: R.Player, scope: PermissionScope.Self }],
  },
  [Permission.VIEW_PLAYER_VIDEOS]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
      { subject: R.ViceCaptain, scope: PermissionScope.OwnTeam },
      { subject: R.Manager, scope: PermissionScope.OwnTeam, tournamentTypes: TENNIS_TYPES },
    ],
  },

  // M. OTP Lockout & Recovery
  [Permission.VIEW_LOCKED_ACCOUNTS_OWN_TEAM]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
    ],
  },
  [Permission.VIEW_LOCKED_ACCOUNTS_ALL]: {
    grants: [{ subject: R.Admin }, { subject: R.ClubManager }],
  },
  [Permission.UNLOCK_ACCOUNT]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager },
      { subject: R.Captain, scope: PermissionScope.OwnTeam },
    ],
  },

  // N. Audit & Announcements
  [Permission.VIEW_ADMIN_OVERVIEW]: {
    grants: [{ subject: R.Admin }],
  },
  [Permission.VIEW_AUDIT_LOG]: {
    grants: [{ subject: R.Admin }],
  },
  [Permission.SEND_ANNOUNCEMENT]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
  [Permission.ADD_YOUTUBE_URL]: {
    grants: [
      { subject: R.Admin },
      { subject: R.ClubManager, scope: PermissionScope.Organizer },
      { subject: R.CenterSevak, scope: PermissionScope.Organizer },
    ],
  },
};

/**
 * The facts the matrix is evaluated against — the (Role × Tournament Type ×
 * scope) tuple from the doc's cross-cutting rules. `subjects` is the set of
 * effective subjects the actor holds in the given context (their global role,
 * any scoped role assignments resolved for this tournament/team/center, and
 * `SCORER` when an active match grant exists).
 */
export interface PermissionContext {
  subjects: GrantSubject[];
  tournamentType?: TournamentType;
  /** B1: actor organizes the tournament in context. */
  isOrganizer?: boolean;
  /** OWN_CENTER: actor's Center matches the target's Center. */
  sameCenter?: boolean;
  /** OWN_TEAM: actor's scoped captaincy/management matches the target team. */
  sameTeam?: boolean;
  /** SELF: the target record belongs to the actor. */
  isSelf?: boolean;
  /** E1: the context team's Captain is currently suspended. */
  captainSuspended?: boolean;
  /** §31 #1: BOTH the context team's Captain and Vice Captain are suspended. */
  leadersSuspended?: boolean;
}
