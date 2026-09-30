import {
  BALL_TYPE_LABELS,
  BallType,
  DEFAULT_VENUE_TIMEZONE,
  formatTournamentFeeCad,
  supportsKnockoutStage,
  type TournamentDetail,
} from '@acc/types';

import { scopeLabelFor } from '../manage/tournament-form';

export interface DetailRow {
  label: string;
  /** Multiple values render one per line (e.g. tennis match days). */
  value: string | string[];
}

export interface DetailSection {
  title: string;
  rows: DetailRow[];
}

const NOT_SET = 'Not set';

// Tournament days are calendar dates (YYYY-MM-DD) — format in UTC so they never shift a day.
const CALENDAR_DAY = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatCalendarDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? date : CALENDAR_DAY.format(parsed);
}

/** UTC instant → "Oct 1, 2026, 9:30 a.m." in the venue timezone. */
export function formatVenueInstant(iso: string | null, timezone: string | null): string {
  if (!iso) return NOT_SET;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return NOT_SET;
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone ?? DEFAULT_VENUE_TIMEZONE,
  }).format(parsed);
}

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');
const fee = (amount: number | null): string => formatTournamentFeeCad(amount) ?? NOT_SET;

/** The values entered on Add / Edit Tournament, grouped like the form's sections. */
export function buildTournamentDetailSections(t: TournamentDetail): DetailSection[] {
  const isTennis = t.ballType === BallType.Tennis;
  const days = [...t.dates].sort();
  const firstDay = days[0];
  const lastDay = days.at(-1);
  const tz = t.timezone;
  const { provinceName, centerNames } = t.scopeDisplay;

  const schedule: DetailRow[] = isTennis
    ? [
        {
          label: 'Tournament Dates',
          value: days.length > 0 ? days.map(formatCalendarDay) : NOT_SET,
        },
      ]
    : [
        { label: 'From Date', value: firstDay ? formatCalendarDay(firstDay) : NOT_SET },
        { label: 'End Date', value: lastDay ? formatCalendarDay(lastDay) : NOT_SET },
      ];
  schedule.push({ label: 'Province', value: provinceName ?? NOT_SET });
  if (isTennis) {
    schedule.push({ label: 'Tournament Type', value: scopeLabelFor(t) });
    if (centerNames.length > 0) schedule.push({ label: 'Centers', value: centerNames });
    schedule.push({ label: 'Location', value: t.locationAddress?.trim() || NOT_SET });
  }

  const teams: DetailRow[] = [
    { label: 'Number of Teams', value: String(t.numberOfTeams) },
    {
      label: 'Players per Team',
      value: t.playersPerTeam != null ? String(t.playersPerTeam) : NOT_SET,
    },
  ];
  if (supportsKnockoutStage(t.type)) {
    teams.push({
      label: 'Knockout Teams',
      value: t.knockoutTeamCount != null ? String(t.knockoutTeamCount) : NOT_SET,
    });
  }

  const registration: DetailRow[] = t.hasRegistrationWindow
    ? [
        { label: 'Registration Open', value: formatVenueInstant(t.registrationOpenAt, tz) },
        { label: 'Registration Close', value: formatVenueInstant(t.registrationCloseAt, tz) },
      ]
    : [{ label: 'Registration Window', value: NOT_SET }];
  if (isTennis) {
    registration.push({ label: 'Tournament Fees', value: fee(t.feeFullTime) });
  } else {
    registration.push(
      { label: 'Full-time Player Fees', value: fee(t.feeFullTime) },
      { label: 'Part-time Player Fees', value: fee(t.feePartTime) },
    );
  }

  const sections: DetailSection[] = [
    {
      title: 'Tournament',
      rows: [
        { label: 'Tournament Name', value: t.name },
        { label: 'Ball Type', value: BALL_TYPE_LABELS[t.ballType] },
        { label: 'Tournament Year', value: String(t.year) },
      ],
    },
    { title: 'Schedule & venue', rows: schedule },
    { title: 'Teams', rows: teams },
    { title: 'Registration & fees', rows: registration },
  ];

  if (isTennis) {
    const tennis: DetailRow[] = [
      { label: 'Auction Date', value: formatVenueInstant(t.auctionAt, tz) },
      { label: 'Impact Player', value: yesNo(t.impactPlayerEnabled) },
      { label: 'Video Required', value: yesNo(t.videoRequired) },
    ];
    if (t.videoRequired) {
      tennis.push(
        { label: 'Upload Start', value: formatVenueInstant(t.videoUploadStartAt, tz) },
        { label: 'Upload End', value: formatVenueInstant(t.videoUploadEndDate, tz) },
      );
    }
    sections.push({ title: 'Tennis options', rows: tennis });
  }

  return sections;
}
