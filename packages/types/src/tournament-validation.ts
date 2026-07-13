/** Client/server validation messages for the Add Tournament form (§6.1). */
export const TOURNAMENT_FORM_MESSAGES = {
  poster: {
    required: 'Tournament poster is required',
    type: 'Poster must be a JPG image',
    size: 'Poster must be under 5MB',
  },
  name: {
    required: 'Tournament name is required',
  },
  year: {
    required: 'Tournament year is required',
  },
  tournamentDates: {
    required: 'Select at least one tournament date',
    leatherFromRequired: 'From date is required',
    leatherEndRequired: 'End date is required',
    past: 'Choose today or a future date',
    endBeforeFrom: 'End date must be on or after from date',
    matchOutsideSpan: (date: string) =>
      `Cannot shorten the span — a match is scheduled on ${date}`,
    hasScheduledMatch: (date: string) =>
      `Cannot remove ${date} — a match is already scheduled on this date`,
  },
  tournamentLocation: {
    required: 'Tournament location is required',
    coordinates: 'Select a location from the map or search results',
  },
  ballType: {
    required: 'Please select a ball type',
  },
  citySelection: {
    required: 'Please select tournament scope',
  },
  province: {
    required: 'Please select a province',
  },
  centers: {
    required: 'Select at least one center',
  },
  numberOfTeams: {
    required: 'Please select the number of teams',
    range: 'Number of teams must be between 2 and 30',
    belowExisting: (count: number) => `Already ${count} teams added`,
  },
  playersPerTeam: {
    notNumeric: 'Players per team must be a number',
    max: 'Maximum 30 players per team',
  },
  registration: {
    required: 'Registration open/close date and time are required',
    closeBeforeOpen: 'Close must be after open',
  },
  auctionDate: {
    required: 'Auction date is required',
  },
  videoUploadStartDate: {
    required: 'Upload start date is required',
    past: 'Choose today or a future date',
  },
  videoUploadStartTime: {
    required: 'Upload start time is required',
  },
  videoUploadEndDate: {
    required: 'Upload end date is required',
    afterStart: 'Upload end must be after upload start',
    afterRegistrationClose: 'Video upload end must be after registration close',
  },
  videoUploadEndTime: {
    required: 'Upload end time is required',
    afterStart: 'Upload end must be after upload start',
  },
  knockoutTeamCount: {
    required: 'Select knockout team count',
    odd: 'Knockout team count must be an even number',
    belowGroupFloor: (min: number) =>
      `Must be at least ${min} to include all group toppers`,
    aboveTotalTeams: (max: number) => `Cannot exceed ${max} teams`,
    notApl: 'Knockout team count applies to APL tournaments only',
    prerequisites: 'Set groups and teams first',
    locked: 'Locked — delete the bracket to change knockout size',
  },
} as const;

export type TournamentFormFieldKey =
  | 'poster'
  | 'name'
  | 'year'
  | 'tournamentDates'
  | 'tournamentLocation'
  | 'leatherFromDate'
  | 'leatherEndDate'
  | 'ballType'
  | 'citySelection'
  | 'province'
  | 'centers'
  | 'numberOfTeams'
  | 'playersPerTeam'
  | 'registrationOpenDate'
  | 'registrationOpenTime'
  | 'registrationCloseDate'
  | 'registrationCloseTime'
  | 'auctionDate'
  | 'videoUploadStartDate'
  | 'videoUploadStartTime'
  | 'videoUploadEndDate'
  | 'videoUploadEndTime'
  | 'knockoutTeamCount';
