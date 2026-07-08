/**
 * APL knockout qualification engine — read-only contracts (Phase 1).
 */

export const QualificationReadinessStatus = {
  NotApplicable: 'NOT_APPLICABLE',
  NotConfigured: 'NOT_CONFIGURED',
  NotReady: 'NOT_READY',
  Ready: 'READY',
} as const;

export type QualificationReadinessStatus =
  (typeof QualificationReadinessStatus)[keyof typeof QualificationReadinessStatus];

export const QualificationType = {
  GroupTopper: 'GROUP_TOPPER',
  Wildcard: 'WILDCARD',
} as const;

export type QualificationType = (typeof QualificationType)[keyof typeof QualificationType];

export const QualificationTieKind = {
  GroupTopper: 'GROUP_TOPPER',
  WildcardCutoff: 'WILDCARD_CUTOFF',
} as const;

export type QualificationTieKind =
  (typeof QualificationTieKind)[keyof typeof QualificationTieKind];

export const QualificationTieResolution = {
  HeadToHead: 'HEAD_TO_HEAD',
  TeamName: 'TEAM_NAME',
} as const;

export type QualificationTieResolution =
  (typeof QualificationTieResolution)[keyof typeof QualificationTieResolution];

export interface QualifiedTeam {
  teamId: string;
  teamName: string;
  qualificationType: QualificationType;
  groupId: string;
  /** 1-based rank within the team's own group standings table. */
  groupRank: number;
  points: number;
  netRunRate: number;
}

export interface QualificationTieFlag {
  kind: QualificationTieKind;
  groupId?: string;
  tiedTeamIds: string[];
  resolvedBy: QualificationTieResolution;
}

export type KnockoutQualificationNotApplicable = {
  status: typeof QualificationReadinessStatus.NotApplicable;
};

export type KnockoutQualificationNotConfigured = {
  status: typeof QualificationReadinessStatus.NotConfigured;
};

export type KnockoutQualificationNotReady = {
  status: typeof QualificationReadinessStatus.NotReady;
  incompleteGroupMatchCount: number;
  scheduledGroupMatchCount: number;
};

export type KnockoutQualificationReady = {
  status: typeof QualificationReadinessStatus.Ready;
  knockoutTeamCount: number;
  groupCount: number;
  qualifiedTeams: QualifiedTeam[];
  ties: QualificationTieFlag[];
};

export type KnockoutQualificationResponse =
  | KnockoutQualificationNotApplicable
  | KnockoutQualificationNotConfigured
  | KnockoutQualificationNotReady
  | KnockoutQualificationReady;
