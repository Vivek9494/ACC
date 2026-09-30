import {
  PERMISSION_MATRIX,
  PermissionScope,
  SCORER_SUBJECT,
  TOURNAMENT_TYPE_LABELS,
  UserRole,
  type GrantSubject,
  type Permission,
  type RoleGrant,
  type TournamentType,
} from '@acc/types';

/** A value read from a shared constant; `source` names the export it came from. */
export interface CodeValue {
  kind: 'code';
  value: string;
  source: string;
}

export type RuleSegment = string | CodeValue;

export interface Rule {
  parts: RuleSegment[];
}

/** A table cell: a single segment, or a sentence mixing text and code values. */
export type RuleCell = RuleSegment | Rule;

export interface RulebookTable {
  columns: string[];
  rows: RuleCell[][];
}

export interface RulebookGroup {
  title: string;
  rules: Rule[];
  table?: RulebookTable;
}

export interface RulebookSection {
  id: string;
  title: string;
  summary: string;
  groups: RulebookGroup[];
}

export function code(value: string | number, source: string): CodeValue {
  return { kind: 'code', value: String(value), source };
}

export function isCodeValue(cell: RuleCell): cell is CodeValue {
  return typeof cell !== 'string' && 'kind' in cell;
}

export function isRule(cell: RuleCell): cell is Rule {
  return typeof cell !== 'string' && 'parts' in cell;
}

/** Every segment of a cell, flattening sentence cells. */
export function cellSegments(cell: RuleCell): RuleSegment[] {
  return isRule(cell) ? cell.parts : [cell];
}

/** Tagged template: `rule\`Win = ${code(10, 'LEATHER_POINTS_WIN')} points\``. */
export function rule(strings: TemplateStringsArray, ...values: RuleSegment[]): Rule {
  const parts: RuleSegment[] = [];
  strings.forEach((text, i) => {
    if (text) parts.push(text);
    const value = values[i];
    if (value !== undefined && value !== '') parts.push(value);
  });
  return { parts };
}

export function ruleText(item: Rule): string {
  return item.parts.map((part) => (isCodeValue(part) ? part.value : part)).join('');
}

export function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** 90 → "1.5 hours", 120 → "2 hours", 10 → "10 minutes". */
export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 30 === 0) {
    return pluralize(minutes / 60, 'hour');
  }
  return pluralize(minutes, 'minute');
}

export function formatSeconds(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? formatMinutes(seconds / 60) : pluralize(seconds, 'second');
}

export function formatMsAsHours(ms: number): string {
  return pluralize(ms / 3_600_000, 'hour');
}

export function formatBytesAsMb(bytes: number): string {
  return `${bytes / (1024 * 1024)} MB`;
}

/** "LEAGUE_SINGLE_ROUND_ROBIN" → "League single round robin". */
export function humanizeConstant(key: string): string {
  const text = key.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const MATRIX_SUBJECTS: readonly GrantSubject[] = [
  UserRole.Admin,
  UserRole.ClubManager,
  UserRole.CenterSevak,
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
  UserRole.Player,
  SCORER_SUBJECT,
];

const SCOPE_LABELS: Record<PermissionScope, string | null> = {
  [PermissionScope.Global]: null,
  [PermissionScope.Organizer]: 'organizer',
  [PermissionScope.OwnCenter]: 'own center',
  [PermissionScope.OwnTeam]: 'own team',
  [PermissionScope.Self]: 'self',
};

function typeList(types: readonly TournamentType[]): string {
  return types.map((type) => TOURNAMENT_TYPE_LABELS[type]).join(' / ');
}

/** Short qualifiers for one grant cell, e.g. ["own team", "ACC"]. */
export function grantQualifiers(grant: RoleGrant): string[] {
  const qualifiers: string[] = [];
  const scope = SCOPE_LABELS[grant.scope ?? PermissionScope.Global];
  if (scope) qualifiers.push(scope);
  if (grant.tournamentTypes?.length) qualifiers.push(typeList(grant.tournamentTypes));
  if (grant.requiresLeadersSuspended) qualifiers.push('only if Captain & VC suspended');
  return qualifiers;
}

export interface PermissionMatrixRow {
  permission: Permission;
  label: string;
  /** Action-wide tournament-type restriction, e.g. "ACC". */
  restriction: string | null;
  /** One entry per {@link MATRIX_SUBJECTS} column: null = not granted, otherwise qualifiers (possibly empty). */
  cells: (string[] | null)[];
}

export function buildPermissionMatrixRows(): PermissionMatrixRow[] {
  return (Object.keys(PERMISSION_MATRIX) as Permission[]).map((permission) => {
    const matrixRule = PERMISSION_MATRIX[permission];
    return {
      permission,
      label: humanizeConstant(permission),
      restriction: matrixRule.tournamentTypes?.length ? typeList(matrixRule.tournamentTypes) : null,
      cells: MATRIX_SUBJECTS.map((subject) => {
        const grants = matrixRule.grants.filter((grant) => grant.subject === subject);
        if (grants.length === 0) return null;
        return grants.flatMap(grantQualifiers);
      }),
    };
  });
}

/** Subjects granted a permission, as display labels (for inline rule text). */
export function grantedSubjects(permission: Permission, labels: Record<GrantSubject, string>): string {
  const subjects = [...new Set(PERMISSION_MATRIX[permission].grants.map((grant) => grant.subject))];
  return subjects.map((subject) => labels[subject]).join(', ');
}
