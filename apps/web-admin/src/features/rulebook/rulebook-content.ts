import {
  ACC_FIXED_TEAM_NAMES,
  ADMIN_PLATFORM_ROLES,
  ADMIN_USER_ROLE_LABELS,
  ATTENDANCE_CAPTURE_LEAD_HOURS,
  AUDIT_LOG_MAX_RANGE_DAYS,
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_REDACTED_VALUE,
  BALL_TYPE_LABELS,
  BALLS_PER_OVER,
  BallType,
  BEST_ECONOMY_MIN_LEGAL_BALLS,
  BEST_STRIKE_RATE_MIN_BALLS,
  BROADCAST_TTL_HOURS,
  CLOSE_REMINDER_LEAD_MINUTES,
  DEFAULT_IMAGE_UPLOAD_MAX_MB,
  DEFAULT_MAX_OVERS_PER_BOWLER,
  DEFAULT_SUBSTITUTES_ALLOWED,
  DEFAULT_TOURNAMENT_FORMAT,
  DEFAULT_VENUE_TIMEZONE,
  DEFAULT_VIDEO_UPLOAD_MAX_MB,
  GEOFENCE_MONITOR_RADIUS_METERS,
  GEOFENCE_RADIUS_METERS,
  isDeletableMatchState,
  isUpcomingMatchForScheduleManagement,
  LEADERBOARD_TOP_N,
  LEATHER_STANDINGS_POINTS,
  LIVE_START_LEAD_MINUTES,
  LIVE_STATS_MIN_COMPLETED_OVERS,
  LOGIN_RATE_LIMIT,
  MATCH_OVERS_PER_INNINGS_LIMITS,
  MATCH_STATE_LABELS,
  MATCH_STATE_TRANSITIONS,
  MatchState,
  MAX_IMPACT_CANDIDATES,
  MAX_SUBSTITUTES,
  MIN_SIGNUP_AGE,
  NOTIFICATION_DAILY_JOB_HOUR,
  NotificationTrigger,
  OTP_IP_RATE_LIMIT,
  OTP_LENGTH,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PARTICIPATION_POLL_CLOSE_HOUR,
  PARTICIPATION_POLL_CLOSE_LEAD_DAYS,
  PARTICIPATION_POLL_OPEN_LEAD_DAYS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_RULES,
  PASSWORD_RESET_LOCK_TTL_MS,
  Permission,
  PLAYING_XI_SIZE,
  REFRESH_IDLE_DAYS,
  REFRESH_IDLE_DAYS_REMEMBER_ME,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS,
  RegistrationStatus,
  RESET_TOKEN_TTL_SECONDS,
  SCORECARD_CONFIRM_WINDOW_HOURS,
  SCORER_ASSIGNMENT_LEAD_MINUTES,
  SCORER_SUBJECT,
  showsNetRunRateForBallType,
  SIGNUP_RATE_LIMIT,
  STANDARD_MATCH_PENALTY_RUNS,
  STANDINGS_SPLIT_POINT_MATCH_STATES,
  SUPER_OVER_OVERS,
  superOverOnTieForBallType,
  TEAM_NAME_MAX_LENGTH,
  TEMP_PASSWORD_TTL_HOURS,
  TENNIS_STANDINGS_POINTS,
  TOURNAMENT_FIELD_LIMITS,
  TOURNAMENT_FORMAT_LABELS,
  TOURNAMENT_SCORER_COUNT,
  TOURNAMENT_STATE_LABELS,
  TOURNAMENT_STATE_TRANSITIONS,
  TOURNAMENT_TYPE_LABELS,
  TournamentType,
  VERIFICATION_REMINDER_LEAD_HOURS,
  WICKETS_FOR_ALL_OUT,
  WICKETS_FOR_SUPER_OVER_ALL_OUT,
  type GrantSubject,
  type MatchState as MatchStateValue,
  type TournamentState,
} from '@acc/types';

import {
  code,
  formatMinutes,
  formatMsAsHours,
  formatSeconds,
  grantedSubjects,
  pluralize,
  rule,
  type RuleCell,
  type RulebookSection,
  type RuleSegment,
} from './rulebook-model';

export const GRANT_SUBJECT_LABELS: Record<GrantSubject, string> = {
  ...ADMIN_USER_ROLE_LABELS,
  [SCORER_SUBJECT]: 'Scorer (per-match)',
};

const who = (permission: Permission): RuleSegment =>
  code(grantedSubjects(permission, GRANT_SUBJECT_LABELS), `PERMISSION_MATRIX.${permission}`);

const tournamentState = (state: TournamentState) => TOURNAMENT_STATE_LABELS[state];
const matchState = (state: MatchStateValue) => MATCH_STATE_LABELS[state];

const ALL_MATCH_STATES = Object.values(MatchState);

function stateList(states: readonly MatchStateValue[]): string {
  return states.map(matchState).join(', ');
}

function transitionRows<S extends string>(
  transitions: Record<S, readonly S[]>,
  label: (state: S) => string,
  source: string,
): RuleSegment[][] {
  return (Object.keys(transitions) as S[]).map((from) => {
    const next = transitions[from];
    return [label(from), next.length ? code(next.map(label).join(', '), source) : '— (final)'];
  });
}

const pointsRows = (ballType: BallType): RuleSegment[] => {
  const points = ballType === BallType.Leather ? LEATHER_STANDINGS_POINTS : TENNIS_STANDINGS_POINTS;
  const source = ballType === BallType.Leather ? 'LEATHER_STANDINGS_POINTS' : 'TENNIS_STANDINGS_POINTS';
  return [
    BALL_TYPE_LABELS[ballType],
    code(points.win, `${source}.win`),
    code(points.tieOrNoResult, `${source}.tieOrNoResult`),
    code(points.tieOrNoResult, `${source}.tieOrNoResult`),
    code(points.loss, `${source}.loss`),
  ];
};

type TriggerKey = keyof typeof NotificationTrigger;

const notice = (key: TriggerKey, label: string): RuleSegment => code(label, `NotificationTrigger.${key}`);

const noticeRow = (key: TriggerKey, label: string, when: RuleCell, who: RuleCell): RuleCell[] => [
  notice(key, label),
  when,
  who,
];

const NOTICE_COLUMNS = ['Notification', 'When it is sent', 'Who receives it'];
const REGISTERED_PLAYERS = 'Registered players (Confirmed + In Waitlist)';
const TOURNAMENT_AUDIENCE = 'Tournament audience';
const BOTH_SQUADS = 'Both teams’ squads (home squad only vs an external team)';
const dailyAt = code(`${NOTIFICATION_DAILY_JOB_HOUR}:00`, 'NOTIFICATION_DAILY_JOB_HOUR');
const closeLead = code(formatMinutes(CLOSE_REMINDER_LEAD_MINUTES), 'CLOSE_REMINDER_LEAD_MINUTES');

const leatherLabel = BALL_TYPE_LABELS[BallType.Leather];
const tennisLabel = BALL_TYPE_LABELS[BallType.Tennis];
const accLabel = TOURNAMENT_TYPE_LABELS[TournamentType.ACC];

export const RULEBOOK_SECTIONS: readonly RulebookSection[] = [
  {
    id: 'tournaments',
    title: 'Tournaments',
    summary: 'Tournament types, formats, lifecycle, points and standings.',
    groups: [
      {
        title: 'Tournament type',
        rules: [
          rule`The type is derived from the ball type and city selection when a tournament is created: ${code(leatherLabel, 'BallType.Leather')} ball → ${code(accLabel, 'TournamentType.ACC')}; ${code(tennisLabel, 'BallType.Tennis')} ball with the APL city option → ${code(TOURNAMENT_TYPE_LABELS[TournamentType.APL], 'TournamentType.APL')}; tennis ball with a single city or several cities → ${code(TOURNAMENT_TYPE_LABELS[TournamentType.Center], 'TournamentType.Center')}. A tennis tournament without a city selection is rejected.`,
          rule`The creator's role does not change the type. It only decides whether the creator may create that type — ACC: ${who(Permission.CREATE_ACC_TOURNAMENT)}; APL: ${who(Permission.CREATE_APL_TOURNAMENT)}; Center-level: ${who(Permission.CREATE_CENTER_TOURNAMENT)}.`,
          rule`The Manager role does not exist in ${code(accLabel, 'managerRoleAllowed')} tournaments.`,
        ],
      },
      {
        title: 'Formats and limits',
        rules: [
          rule`Available formats: ${code(Object.values(TOURNAMENT_FORMAT_LABELS).join(' · '), 'TOURNAMENT_FORMAT_LABELS')}. New tournaments default to ${code(TOURNAMENT_FORMAT_LABELS[DEFAULT_TOURNAMENT_FORMAT], 'DEFAULT_TOURNAMENT_FORMAT')}.`,
          rule`Number of teams: ${code(TOURNAMENT_FIELD_LIMITS.numberOfTeams.min, 'TOURNAMENT_FIELD_LIMITS.numberOfTeams.min')} to ${code(TOURNAMENT_FIELD_LIMITS.numberOfTeams.max, 'TOURNAMENT_FIELD_LIMITS.numberOfTeams.max')}. Players per team: up to ${code(TOURNAMENT_FIELD_LIMITS.playersPerTeam.max, 'TOURNAMENT_FIELD_LIMITS.playersPerTeam.max')} (optional). Substitutes allowed: ${code(TOURNAMENT_FIELD_LIMITS.substitutesAllowed.min, 'TOURNAMENT_FIELD_LIMITS.substitutesAllowed.min')} to ${code(TOURNAMENT_FIELD_LIMITS.substitutesAllowed.max, 'TOURNAMENT_FIELD_LIMITS.substitutesAllowed.max')}, default ${code(DEFAULT_SUBSTITUTES_ALLOWED, 'DEFAULT_SUBSTITUTES_ALLOWED')}.`,
          rule`Default maximum overs per bowler: ${code(DEFAULT_MAX_OVERS_PER_BOWLER[BallType.Leather], 'DEFAULT_MAX_OVERS_PER_BOWLER.LEATHER')} for leather, ${code(DEFAULT_MAX_OVERS_PER_BOWLER[BallType.Tennis], 'DEFAULT_MAX_OVERS_PER_BOWLER.TENNIS')} for tennis. Overs per innings: ${code(MATCH_OVERS_PER_INNINGS_LIMITS.min, 'MATCH_OVERS_PER_INNINGS_LIMITS.min')} to ${code(MATCH_OVERS_PER_INNINGS_LIMITS.max, 'MATCH_OVERS_PER_INNINGS_LIMITS.max')}.`,
        ],
      },
      {
        title: 'Lifecycle and finalization',
        rules: [
          rule`A tournament moves through its states only along the transitions below. Only this map is checked: moving to ${code(tournamentState('TEAMS_FINALIZED'), 'TournamentState.TeamsFinalized')} or ${code(tournamentState('FIXTURE_PUBLISHED'), 'TournamentState.FixturePublished')} has no extra requirements (such as team counts).`,
          rule`Closed registration can be reopened. ${code(tournamentState('COMPLETED'), 'TournamentState.Completed')} is final.`,
          rule`Who can change the status: ${who(Permission.CHANGE_TOURNAMENT_STATUS)} (Club Manager and Center Sevak only for tournaments they organize).`,
          rule`Deleting a tournament is a soft delete, allowed in any state, by ${who(Permission.EDIT_TOURNAMENT)}. If registration is open, registrants are notified first.`,
        ],
        table: {
          columns: ['From', 'Can move to'],
          rows: transitionRows(TOURNAMENT_STATE_TRANSITIONS, tournamentState, 'TOURNAMENT_STATE_TRANSITIONS'),
        },
      },
      {
        title: 'Points schedule',
        rules: [
          rule`Standings count Completed, Scorecard Locked, No Result and Cancelled matches. ${code(stateList(STANDINGS_SPLIT_POINT_MATCH_STATES), 'STANDINGS_SPLIT_POINT_MATCH_STATES')} matches give each team the tie / no-result points and are left out of net run rate.`,
          rule`${leatherLabel} ties are final: points are split and there is ${code(superOverOnTieForBallType(BallType.Leather) ? 'a' : 'no', 'superOverOnTieForBallType')} Super Over. ${tennisLabel} ties are decided by a Super Over.`,
          rule`Standings order: points (high to low), then net run rate (${code(showsNetRunRateForBallType(BallType.Tennis) ? 'tennis' : '—', 'showsNetRunRateForBallType')} only; ${showsNetRunRateForBallType(BallType.Leather) ? 'also shown' : 'not shown'} for leather), then team name A–Z.`,
        ],
        table: {
          columns: ['Ball type', 'Win', 'Tie', 'No result', 'Loss'],
          rows: [pointsRows(BallType.Leather), pointsRows(BallType.Tennis)],
        },
      },
      {
        title: 'Knockouts',
        rules: [
          rule`When a knockout match's scorecard is confirmed, the winner is placed into the next match automatically. The winner of the final becomes the tournament champion.`,
          rule`Setting the champion does not complete the tournament; the status is still changed manually.`,
        ],
      },
    ],
  },
  {
    id: 'users-roles',
    title: 'Users & roles',
    summary: 'Platform roles, tournament-scoped roles, accounts and the permission matrix.',
    groups: [
      {
        title: 'Global vs tournament-scoped roles',
        rules: [
          rule`Platform (global) roles: ${code(ADMIN_PLATFORM_ROLES.map((role) => ADMIN_USER_ROLE_LABELS[role]).join(', '), 'ADMIN_PLATFORM_ROLES')}. Only ${who(Permission.MANAGE_ADMIN_USERS)} can change a user's platform role. Changing the role or mobile number signs the user out everywhere.`,
          rule`Captain, Vice Captain and Manager are tournament-scoped: they are held per team, per tournament, and never change the user's platform role.`,
          rule`Scorer is not a role: it is a per-match grant that is revoked when the match ends. Tennis tournaments keep a pool of ${code(TOURNAMENT_SCORER_COUNT, 'TOURNAMENT_SCORER_COUNT')} scorers.`,
          rule`Who assigns Captain / Vice Captain / Manager: Admin always; on ACC and APL the Club Manager; on Center-level the organizing Center Sevak.`,
        ],
      },
      {
        title: 'Accounts and sign-in',
        rules: [
          rule`Users must be at least ${code(MIN_SIGNUP_AGE, 'MIN_SIGNUP_AGE')} years old to sign up.`,
          rule`Password policy: at least ${code(PASSWORD_MIN_LENGTH, 'PASSWORD_MIN_LENGTH')} characters; ${code(PASSWORD_POLICY_RULES.filter((item) => item.id !== 'minLength').map((item) => item.label.toLowerCase()).join('; '), 'PASSWORD_POLICY_RULES')}.`,
          rule`Login is limited to ${code(LOGIN_RATE_LIMIT.maxAttempts, 'LOGIN_RATE_LIMIT.maxAttempts')} failed attempts per mobile number in ${code(formatSeconds(LOGIN_RATE_LIMIT.windowSeconds), 'LOGIN_RATE_LIMIT.windowSeconds')}; signup to ${code(SIGNUP_RATE_LIMIT.maxAttempts, 'SIGNUP_RATE_LIMIT.maxAttempts')} attempts per number in ${code(formatSeconds(SIGNUP_RATE_LIMIT.windowSeconds), 'SIGNUP_RATE_LIMIT.windowSeconds')}.`,
          rule`Sessions expire after ${code(pluralize(REFRESH_IDLE_DAYS, 'day'), 'REFRESH_IDLE_DAYS')} without use, or ${code(pluralize(REFRESH_IDLE_DAYS_REMEMBER_ME, 'day'), 'REFRESH_IDLE_DAYS_REMEMBER_ME')} with Remember Me. One device at a time: a new login signs out the previous device.`,
          rule`Admin-issued temporary passwords expire after ${code(pluralize(TEMP_PASSWORD_TTL_HOURS, 'hour'), 'TEMP_PASSWORD_TTL_HOURS')} and must be changed at first login.`,
        ],
      },
    ],
  },
  {
    id: 'registration',
    title: 'Registration & verification',
    summary: 'Registration windows, verification deadline, auto-confirm and leather access.',
    groups: [
      {
        title: 'Registration window',
        rules: [
          rule`Registration is open when both the open and close dates are set and now is between them (both ends included). The close date must be after the open date.`,
          rule`Players, Center Sevaks and Club Managers can register themselves.`,
          rule`The tournament's audience gets a "registration closing soon" notification ${code(formatMinutes(CLOSE_REMINDER_LEAD_MINUTES), 'CLOSE_REMINDER_LEAD_MINUTES')} before registration closes.`,
        ],
      },
      {
        title: 'Status and verification (tennis)',
        rules: [
          rule`Statuses: ${code(Object.values(REGISTRATION_STATUS_LABELS).join(', '), 'REGISTRATION_STATUS_LABELS')}. A tennis registration starts in ${code(REGISTRATION_STATUS_LABELS[RegistrationStatus.InWaitlist], 'RegistrationStatus.InWaitlist')}; resubmitting puts it back there.`,
          rule`Verification (approve / decline / revert to waitlist / ratings) is done by ${who(Permission.APPROVE_REGISTRATION)} — Center Sevaks only for their own participating centers.`,
          rule`Verification deadline: the auction date if one is set, otherwise ${code(formatMsAsHours(REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS), 'REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS')} after registration closes. Center Sevaks get a reminder ${code(pluralize(VERIFICATION_REMINDER_LEAD_HOURS, 'hour'), 'VERIFICATION_REMINDER_LEAD_HOURS')} before it.`,
          rule`Auto-confirm: at the deadline, every registration still ${REGISTRATION_STATUS_LABELS[RegistrationStatus.InWaitlist]} becomes ${code(REGISTRATION_STATUS_LABELS[RegistrationStatus.Confirmed], 'RegistrationStatus.Confirmed')} and the player is notified. Declined registrations are not changed.`,
          rule`Late registration by ${who(Permission.REGISTER_LATE_PLAYER)} (Center Sevak: own center, tennis only) is ${code(REGISTRATION_STATUS_LABELS[RegistrationStatus.Confirmed], 'RegistrationStatus.Confirmed')} immediately.`,
        ],
      },
      {
        title: 'Leather (ACC)',
        rules: [
          rule`${leatherLabel} registrations are ${code(REGISTRATION_STATUS_LABELS[RegistrationStatus.Confirmed], 'RegistrationStatus.Confirmed')} on submit; there is no verification step and Center Sevaks cannot verify them.`,
          rule`Leather tournaments are visible to Admins, Club Managers, existing leather players (in a locked Playing 11 of a leather match, or on a leather team roster in an active tournament) and invited users.`,
          rule`Registering needs one of: Club Manager, existing leather player, or an invite. Invites are managed by Admins while the tournament is upcoming or live.`,
        ],
      },
    ],
  },
  {
    id: 'teams',
    title: 'Teams',
    summary: 'Roster size, leadership roles and team names.',
    groups: [
      {
        title: 'Roster',
        rules: [
          rule`Team names are up to ${code(TEAM_NAME_MAX_LENGTH, 'TEAM_NAME_MAX_LENGTH')} characters and unique within a tournament (case-insensitive).`,
          rule`The roster cap is the tournament's "players per team" (max ${code(TOURNAMENT_FIELD_LIMITS.playersPerTeam.max, 'TOURNAMENT_FIELD_LIMITS.playersPerTeam.max')}). It applies only when that field is set; otherwise rosters are unlimited.`,
          rule`Only Confirmed registrants who are not on another team in the tournament can be added.`,
          rule`${code(ACC_FIXED_TEAM_NAMES.join(', '), 'ACC_FIXED_TEAM_NAMES')} are the fixed ACC team names used by statistics and overlays; teams are not created automatically.`,
        ],
      },
      {
        title: 'Captain, Vice Captain and Manager',
        rules: [
          rule`Each team has at most one Captain, one Vice Captain and one Manager, and one person cannot hold two of these roles on the same team.`,
          rule`The person must be active and a Confirmed registrant (or already on the team); they are added to the roster automatically and cannot be on another team.`,
          rule`Manager cannot be assigned in ${code(leatherLabel, 'BallType.Leather')} (ACC) tournaments.`,
          rule`Roles can be assigned once registration closes, or ${code(formatMsAsHours(REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS), 'REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS')} after it opens when there is no close date.`,
          rule`Removing a player from the roster also removes their leadership role on that team. The Vice Captain has the same permissions as the Captain.`,
        ],
      },
    ],
  },
  {
    id: 'matches',
    title: 'Matches',
    summary: 'Match states, edit / delete rules, starting a match, Playing 11 and ACC attendance.',
    groups: [
      {
        title: 'Match states',
        rules: [
          rule`Delayed and Rain Interrupted are recoverable; Completed, No Result, Cancelled and Scorecard Locked are final. Scorer grants are revoked when a match reaches a final state.`,
        ],
        table: {
          columns: ['From', 'Can move to'],
          rows: transitionRows(MATCH_STATE_TRANSITIONS, matchState, 'MATCH_STATE_TRANSITIONS'),
        },
      },
      {
        title: 'Create, edit and delete',
        rules: [
          rule`Create: ${who(Permission.CREATE_MATCH)} (Captain / Vice Captain: ACC, own team). Edit: ${who(Permission.EDIT_MATCH)}. Delete: ${who(Permission.DELETE_MATCH)}.`,
          rule`Editable states: ${code(stateList(ALL_MATCH_STATES.filter(isUpcomingMatchForScheduleManagement)), 'isUpcomingMatchForScheduleManagement')}. The teams can only be changed while ${matchState(MatchState.Scheduled)} or ${matchState(MatchState.Delayed)}. Changing the date or time notifies players.`,
          rule`Deletable states: ${code(stateList(ALL_MATCH_STATES.filter(isDeletableMatchState)), 'isDeletableMatchState')}. Knockout-bracket matches cannot be deleted. Deletion is a soft delete and releases suspensions / penalties that depended on the match.`,
        ],
      },
      {
        title: 'Match day',
        rules: [
          rule`A match can go live no earlier than ${code(formatMinutes(LIVE_START_LEAD_MINUTES), 'LIVE_START_LEAD_MINUTES')} before the scheduled start.`,
          rule`The Captain's scorer-assignment card appears ${code(formatMinutes(SCORER_ASSIGNMENT_LEAD_MINUTES), 'SCORER_ASSIGNMENT_LEAD_MINUTES')} before the start on match day.`,
          rule`Tennis: the scorer cannot be changed once the match is live or finished, except a mid-match swap by Admin / Club Manager. ACC: only the Captain who assigned the scorer can change them.`,
          rule`Playing 11: exactly ${code(PLAYING_XI_SIZE, 'PLAYING_XI_SIZE')} players, up to ${code(MAX_SUBSTITUTES, 'MAX_SUBSTITUTES')} substitutes and up to ${code(MAX_IMPACT_CANDIDATES, 'MAX_IMPACT_CANDIDATES')} impact-player candidates (one is active).`,
        ],
      },
      {
        title: 'ACC availability and attendance',
        rules: [
          rule`Availability polls open ${code(pluralize(PARTICIPATION_POLL_OPEN_LEAD_DAYS, 'day'), 'PARTICIPATION_POLL_OPEN_LEAD_DAYS')} before the match date and close at ${code(`${PARTICIPATION_POLL_CLOSE_HOUR}:00`, 'PARTICIPATION_POLL_CLOSE_HOUR')} venue time, ${code(pluralize(PARTICIPATION_POLL_CLOSE_LEAD_DAYS, 'day'), 'PARTICIPATION_POLL_CLOSE_LEAD_DAYS')} before the match.`,
          rule`Check-in opens ${code(pluralize(ATTENDANCE_CAPTURE_LEAD_HOURS, 'hour'), 'ATTENDANCE_CAPTURE_LEAD_HOURS')} before reporting time and counts within ${code(`${GEOFENCE_RADIUS_METERS} m`, 'GEOFENCE_RADIUS_METERS')} of the ground (the phone monitors a ${code(`${GEOFENCE_MONITOR_RADIUS_METERS} m`, 'GEOFENCE_MONITOR_RADIUS_METERS')} zone).`,
          rule`Checking in after reporting time marks the player late; late players are suspended for the next match once the leather match completes.`,
        ],
      },
    ],
  },
  {
    id: 'scoring',
    title: 'Scoring',
    summary: 'Overs, Super Overs, penalties and scorecard confirmation.',
    groups: [
      {
        title: 'Overs and wickets',
        rules: [
          rule`${code(BALLS_PER_OVER, 'BALLS_PER_OVER')} legal balls per over; an innings ends at ${code(WICKETS_FOR_ALL_OUT, 'WICKETS_FOR_ALL_OUT')} wickets.`,
          rule`A bowler cannot bowl consecutive overs. The per-bowler overs quota is shown in the bowler picker ("Quota reached"), but it is not rejected when a delivery is recorded.`,
        ],
      },
      {
        title: 'Super Over',
        rules: [
          rule`${leatherLabel}: ${code(superOverOnTieForBallType(BallType.Leather) ? 'Super Over on a tie' : 'no Super Over', 'superOverOnTieForBallType')} — a tie is final.`,
          rule`${tennisLabel}: a tie goes to a Super Over of ${code(pluralize(SUPER_OVER_OVERS, 'over'), 'SUPER_OVER_OVERS')}, all out at ${code(WICKETS_FOR_SUPER_OVER_ALL_OUT, 'WICKETS_FOR_SUPER_OVER_ALL_OUT')} wickets.`,
        ],
      },
      {
        title: 'Penalties and DLS',
        rules: [
          rule`Penalty runs default to ${code(STANDARD_MATCH_PENALTY_RUNS, 'STANDARD_MATCH_PENALTY_RUNS')} in the scoring app and are credited to the chosen team.`,
          rule`The DLS target is entered manually (not calculated) by ${who(Permission.ENTER_DLS_TARGET)}, and replaces the chase target.`,
        ],
      },
      {
        title: 'Scorecard confirmation',
        rules: [
          rule`Confirm: ${who(Permission.CONFIRM_SCORECARD)}. The scorecard locks when both teams confirm, or when an Admin confirms.`,
          rule`Scorecards not confirmed within ${code(pluralize(SCORECARD_CONFIRM_WINDOW_HOURS, 'hour'), 'SCORECARD_CONFIRM_WINDOW_HOURS')} of the match ending are confirmed automatically by the System.`,
          rule`Editing after confirmation: ${who(Permission.EDIT_SCORECARD_POST_CONFIRM)} (Club Manager: ACC only).`,
        ],
      },
      {
        title: 'Statistics',
        rules: [
          rule`Leaderboards show the top ${code(LEADERBOARD_TOP_N, 'LEADERBOARD_TOP_N')}. Best strike rate needs ${code(BEST_STRIKE_RATE_MIN_BALLS, 'BEST_STRIKE_RATE_MIN_BALLS')} balls faced; best economy needs ${code(BEST_ECONOMY_MIN_LEGAL_BALLS, 'BEST_ECONOMY_MIN_LEGAL_BALLS')} legal balls bowled.`,
          rule`Live run rates appear after ${code(pluralize(LIVE_STATS_MIN_COMPLETED_OVERS, 'completed over'), 'LIVE_STATS_MIN_COMPLETED_OVERS')}. Averages, strike rates and economy are calculated when viewed, never stored.`,
        ],
      },
    ],
  },
  {
    id: 'password-otp',
    title: 'Forgot password / OTP',
    summary: 'OTP codes, request limits, 24-hour lockout and unlocking.',
    groups: [
      {
        title: 'OTP codes',
        rules: [
          rule`Codes are ${code(OTP_LENGTH, 'OTP_LENGTH')} digits, valid for ${code(formatSeconds(OTP_TTL_SECONDS), 'OTP_TTL_SECONDS')}, with a ${code(formatSeconds(OTP_RESEND_COOLDOWN_SECONDS), 'OTP_RESEND_COOLDOWN_SECONDS')} wait between resends.`,
          rule`After ${code(OTP_MAX_FAILED_ATTEMPTS, 'OTP_MAX_FAILED_ATTEMPTS')} wrong entries the code is invalidated and a new one must be requested.`,
          rule`A verified code allows setting a new password for ${code(formatSeconds(RESET_TOKEN_TTL_SECONDS), 'RESET_TOKEN_TTL_SECONDS')}. Each client IP is limited to ${code(OTP_IP_RATE_LIMIT.maxAttempts, 'OTP_IP_RATE_LIMIT.maxAttempts')} send / verify requests per ${code(formatSeconds(OTP_IP_RATE_LIMIT.windowSeconds), 'OTP_IP_RATE_LIMIT.windowSeconds')}.`,
        ],
      },
      {
        title: 'Lockout and unlock',
        rules: [
          rule`Requesting more than ${code(OTP_MAX_REQUESTS_PER_DAY, 'OTP_MAX_REQUESTS_PER_DAY')} codes in a day locks password reset for ${code(formatMsAsHours(PASSWORD_RESET_LOCK_TTL_MS), 'PASSWORD_RESET_LOCK_TTL_MS')}. (Wrong codes invalidate the code but do not lock the account.)`,
          rule`The lock expires by itself after that window. It is also cleared by ${who(Permission.UNLOCK_ACCOUNT)} (Users → Unlock), or by a successful login.`,
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Push notifications',
    summary: 'What triggers a push, who receives it, and how delivery works.',
    groups: [
      {
        title: 'Audiences',
        rules: [
          rule`Tournament audience — tennis: every active user whose home center is one of the tournament's centers. Leather: every active user who has been in a leather match squad (Playing 11 or substitute); invited users and Admins / Club Managers who have not played are not included.`,
          rule`Registered players are Confirmed and In Waitlist registrants (never Declined). A squad is the team's full active roster, not only the Playing 11.`,
          rule`The person who caused the event is not excluded — e.g. the Admin who posts a broadcast also receives it.`,
        ],
      },
      {
        title: 'Tournaments & registration',
        rules: [],
        table: {
          columns: NOTICE_COLUMNS,
          rows: [
            noticeRow('NewTournamentCreated', 'New tournament', 'A tournament is created (including clones).', TOURNAMENT_AUDIENCE),
            noticeRow('RegistrationOpened', 'Registration open', 'The registration open time arrives (checked every minute). Once per tournament.', TOURNAMENT_AUDIENCE),
            noticeRow('RegistrationClosing', 'Registration closing soon', rule`${closeLead} before registration closes.`, TOURNAMENT_AUDIENCE),
            noticeRow('RegistrationConfirmed', 'Registration confirmed', 'A registration becomes Confirmed: leather self-registration, late registration, tennis approval, or waitlist auto-confirm at the verification deadline. Once per registration.', 'The registrant'),
            noticeRow('RegistrationDeclined', 'Registration declined', 'A tennis In Waitlist registration is declined.', 'The registrant'),
            noticeRow('VerificationReminder', 'Verification reminder', rule`Tennis only: ${code(pluralize(VERIFICATION_REMINDER_LEAD_HOURS, 'hour'), 'VERIFICATION_REMINDER_LEAD_HOURS')} before the verification deadline.`, 'Center Sevaks of the tournament’s centers'),
            noticeRow('VideoUploadDeadline', 'Video upload deadline', 'On registration, when the tournament requires a video and has an upload deadline.', 'The registrant'),
            noticeRow('VideoUploadOpened', 'Video upload open', 'The video upload window opens (video required).', REGISTERED_PLAYERS),
            noticeRow('VideoUploadClosing', 'Video upload closing soon', rule`${closeLead} before the video upload deadline.`, REGISTERED_PLAYERS),
            noticeRow('TournamentDatesChanged', 'Tournament dates changed', 'The tournament’s dates are edited (any state).', REGISTERED_PLAYERS),
            noticeRow('TournamentLocationChanged', 'Tournament location changed', 'The address or map location is edited.', REGISTERED_PLAYERS),
            noticeRow('TournamentRegistrationWindowChanged', 'Registration window changed', 'The registration open or close time is edited.', REGISTERED_PLAYERS),
            noticeRow('TournamentVideoPolicyChanged', 'Video policy changed', 'The video requirement or upload dates are edited.', REGISTERED_PLAYERS),
            noticeRow('TournamentDeletedMidRegistration', 'Tournament deleted', 'The tournament is deleted while registration is open.', REGISTERED_PLAYERS),
          ],
        },
      },
      {
        title: 'Teams & matches',
        rules: [],
        table: {
          columns: NOTICE_COLUMNS,
          rows: [
            noticeRow('PlayerAddedToTeam', 'Added to team', 'The player is added to a team roster. Once per player per team.', 'The player'),
            noticeRow('PlayerRemovedFromTeam', 'Removed from team', 'The player is removed from a team roster.', 'The player'),
            noticeRow('MatchScheduled', 'Match scheduled', 'A match is created manually (not knockout-bracket matches or backfilled history).', BOTH_SQUADS),
            noticeRow('MatchRescheduled', 'Match rescheduled', 'The match date or start time changes.', BOTH_SQUADS),
            noticeRow('PlayingXiPosted', 'Playing 11 posted', 'A team’s Playing 11 is locked. Sent again only if the lineup changes.', 'Players in the Playing 11 and substitutes'),
            noticeRow('ScorerAssigned', 'Scorer assigned', 'A scorer is assigned, swapped or handed over.', 'The new scorer'),
            noticeRow('MatchResultConfirmed', 'Match result', 'The scorecard is confirmed with a winner (not ties, no results or external winners).', 'The winning team’s squad'),
            noticeRow('PenaltyServeDesignated', 'Penalty to serve', 'A player owing a late-arrival penalty is given the match where they will serve it.', 'The player'),
            noticeRow('SuspensionCarriedForward', 'Suspension carried forward', 'A Captain carries a pending suspension forward.', 'Club Managers'),
            noticeRow('SuspensionCancelled', 'Suspension cancelled', 'A Captain cancels a suspension.', 'Club Managers'),
          ],
        },
      },
      {
        title: 'Daily reminders and announcements',
        rules: [
          rule`Daily reminders go out at ${dailyAt} venue time (${code(DEFAULT_VENUE_TIMEZONE, 'DEFAULT_VENUE_TIMEZONE')}).`,
        ],
        table: {
          columns: NOTICE_COLUMNS,
          rows: [
            noticeRow('MatchReminder', 'Match tomorrow', rule`Daily at ${dailyAt}, the day before a match that has not started.`, BOTH_SQUADS),
            noticeRow('PollReminder', 'Availability poll reminder', rule`Daily at ${dailyAt} while an ACC availability poll is open.`, 'Team members who have not voted'),
            noticeRow('Birthday', 'Birthday', rule`Daily at ${dailyAt} on a user's birthday.`, 'All active users'),
            noticeRow('BroadcastPosted', 'Broadcast', 'An Admin or Club Manager publishes a broadcast announcement.', 'All active users'),
          ],
        },
      },
      {
        title: 'Delivery',
        rules: [
          rule`Pushes are sent through Firebase Cloud Messaging to every device the user has registered (iOS and Android). A device stays registered until the user logs out on it or FCM rejects its token, so a new login elsewhere does not stop pushes to an old device.`,
          rule`Each notification is sent once: a repeat of the same event is skipped (e.g. re-adding a player to the same team). Tournament edit / deletion and player-removal notices are sent every time.`,
          rule`There is no opt-out: users cannot turn notifications off. Deactivated and deleted accounts receive none.`,
          rule`Timed checks run every minute; only one server runs each scheduled job at a time.`,
          rule`Defined but not sent: ${notice('CaptainRosterChanged', 'Captain roster changed')}; ${notice('TournamentEditedMidRegistration', 'Tournament edited')} (fallback wording only); ${notice('WaitlistAutoConfirm', 'Waitlist auto-confirm')} (internal guard — players receive Registration confirmed).`,
        ],
      },
    ],
  },
  {
    id: 'platform',
    title: 'Audit log & platform',
    summary: 'Audit-log retention, uploads and announcements.',
    groups: [
      {
        title: 'Audit log',
        rules: [
          rule`Viewable by ${who(Permission.VIEW_AUDIT_LOG)} on the Logs page, up to ${code(pluralize(AUDIT_LOG_MAX_RANGE_DAYS, 'day'), 'AUDIT_LOG_MAX_RANGE_DAYS')} per search.`,
          rule`Entries older than ${code(pluralize(AUDIT_LOG_RETENTION_DAYS, 'day'), 'AUDIT_LOG_RETENTION_DAYS')} are deleted by a daily job. Only the audit log is affected; OTP analytics and other data are kept.`,
          rule`Secrets (passwords, tokens, OTP codes, keys) are never stored; any such field is replaced with ${code(AUDIT_REDACTED_VALUE, 'AUDIT_REDACTED_VALUE')}.`,
        ],
      },
      {
        title: 'Uploads and announcements',
        rules: [
          rule`Default upload limits: images ${code(`${DEFAULT_IMAGE_UPLOAD_MAX_MB} MB`, 'DEFAULT_IMAGE_UPLOAD_MAX_MB')}, videos ${code(`${DEFAULT_VIDEO_UPLOAD_MAX_MB} MB`, 'DEFAULT_VIDEO_UPLOAD_MAX_MB')} (adjustable in Settings).`,
          rule`Broadcast announcements stay on dashboards for ${code(pluralize(BROADCAST_TTL_HOURS, 'hour'), 'BROADCAST_TTL_HOURS')}.`,
        ],
      },
    ],
  },
];
