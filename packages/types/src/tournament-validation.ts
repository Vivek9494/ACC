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
    hasScheduledMatch: (date: string) =>
      `Cannot remove ${date} — a match is already scheduled on this date`,
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
    max: 'Maximum 15 players per team',
  },
  registration: {
    required: 'Registration open/close date and time are required',
    closeBeforeOpen: 'Close must be after open',
  },
  auctionDate: {
    required: 'Auction date is required',
  },
  videoUploadEndDate: {
    required: 'Video upload end date is required',
    afterRegistrationClose: 'Video upload end date must be after registration close',
  },
} as const;

export type TournamentFormFieldKey =
  | 'poster'
  | 'name'
  | 'year'
  | 'tournamentDates'
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
  | 'videoUploadEndDate';
