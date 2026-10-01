import type { UserRole } from './auth';

/** Audit-log entries older than this are deleted by the daily retention job. */
export const AUDIT_LOG_RETENTION_DAYS = 7;

export const AUDIT_LOG_PAGE_SIZE = 50;
export const AUDIT_LOG_PAGE_SIZE_MAX = 200;

/** Longest `from`–`to` span one Logs query may cover. */
export const AUDIT_LOG_MAX_RANGE_DAYS = 31;

/** Stored in place of any value whose key names a secret (password, token, OTP, key…). */
export const AUDIT_REDACTED_VALUE = '[redacted]';

/** Label written as the actor for scheduled / automatic events. */
export const AUDIT_SYSTEM_ACTOR_LABEL = 'System';

/** Canonical `targetEntityType` values. */
export const AuditEntityType = {
  AppSettings: 'app_settings',
  Broadcast: 'broadcast',
  Center: 'center',
  Delivery: 'delivery',
  ExternalPlayer: 'external_player',
  Fee: 'fee',
  Group: 'group',
  Innings: 'innings',
  KnockoutBracket: 'knockout_bracket',
  LateArrivalPenalty: 'late_arrival_penalty',
  Match: 'match',
  Media: 'media',
  ParticipationPoll: 'participation_poll',
  PlayerVideo: 'player_video',
  Province: 'province',
  PushToken: 'push_token',
  Registration: 'registration',
  Suspension: 'suspension',
  Team: 'team',
  TeamMembership: 'team_membership',
  Tournament: 'tournament',
  TournamentTypeDefinition: 'tournament_type_definition',
  User: 'user',
} as const;
export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];

export const AUDIT_ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  app_settings: 'App settings',
  broadcast: 'Broadcast',
  center: 'Center',
  delivery: 'Delivery',
  external_player: 'External player',
  fee: 'Fee',
  group: 'Group',
  innings: 'Innings',
  knockout_bracket: 'Knockout bracket',
  late_arrival_penalty: 'Late-arrival penalty',
  match: 'Match',
  media: 'Media',
  participation_poll: 'Availability poll',
  player_video: 'Player video',
  province: 'Province',
  push_token: 'Push token',
  registration: 'Registration',
  suspension: 'Suspension',
  team: 'Team',
  team_membership: 'Team membership',
  tournament: 'Tournament',
  tournament_type_definition: 'Tournament type',
  user: 'User',
};

export function isAuditEntityType(value: string): value is AuditEntityType {
  return Object.prototype.hasOwnProperty.call(AUDIT_ENTITY_TYPE_LABELS, value);
}

/** Display label for a stored entity type (older rows may use other casing). */
export function auditEntityTypeLabel(value: string | null): string {
  if (!value) {
    return '—';
  }
  const key = value.toLowerCase();
  return isAuditEntityType(key) ? AUDIT_ENTITY_TYPE_LABELS[key] : value;
}

/** "TOURNAMENT_STATE_CHANGED" → "Tournament state changed". */
export function auditActionLabel(action: string): string {
  const words = action.toLowerCase().split('_').filter(Boolean);
  if (words.length === 0) {
    return action;
  }
  const [first, ...rest] = words;
  return [`${first?.charAt(0).toUpperCase() ?? ''}${first?.slice(1) ?? ''}`, ...rest].join(' ');
}

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export interface AuditLogActorView {
  /** Null for System events. */
  userId: string | null;
  /** Full name, "System", or "Deleted user" when the account no longer exists. */
  name: string;
  /** The actor's current platform role; null for System. */
  role: UserRole | null;
}

export interface AuditLogEntityView {
  type: string | null;
  id: string | null;
  /** Resolved display name (tournament, team, match fixture, user…); null when unknown. */
  name: string | null;
}

export interface AuditLogEntryView {
  id: string;
  /** UTC ISO 8601. */
  createdAt: string;
  action: string;
  actor: AuditLogActorView;
  entity: AuditLogEntityView;
  /** The affected user, when the entry names one (and differs from the entity). */
  targetUser: { id: string; name: string } | null;
  before: AuditJsonValue | null;
  after: AuditJsonValue | null;
  details: AuditJsonValue | null;
}

/** Offset-paginated audit log (GET /admin/audit-logs). */
export interface AuditLogPage {
  items: AuditLogEntryView[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Query for GET /admin/audit-logs. `from` / `to` are UTC ISO instants, `from` inclusive, `to` exclusive. */
export interface ListAuditLogsParams {
  from: string;
  to: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

/** Filter choices present in the selected range (GET /admin/audit-logs/filters). */
export interface AuditLogFilterOptions {
  actions: string[];
  entityTypes: string[];
  actors: AuditLogActorView[];
}
