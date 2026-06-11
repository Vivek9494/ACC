/** Client/server validation messages for the Add Tournament form (§6.1). */
export const TOURNAMENT_FORM_MESSAGES = {
  name: {
    required: 'Tournament name is required',
    max: 'Max 120 characters',
  },
  year: {
    required: 'Select a tournament year',
  },
  startDate: {
    required: 'Tournament start date is required',
  },
  endDate: {
    required: 'Tournament end date is required',
    beforeStart: 'End date must be on or after the start date',
  },
  ballType: {
    required: 'Select a ball type',
  },
  citySelection: {
    required: 'Select who this tournament is for',
  },
  province: {
    required: 'Select a province',
  },
  centers: {
    required: 'Select at least one center',
  },
  oversPerInnings: {
    required: 'Overs per innings is required',
    range: 'Overs per innings must be between 1 and 50',
  },
  numberOfTeams: {
    required: 'Number of teams is required',
    range: 'Number of teams must be between 2 and 64',
  },
  playersPerTeam: {
    required: 'Players per team is required',
    range: 'Players per team must be at least 11 and at most 30',
  },
  substitutesAllowed: {
    required: 'Substitutes allowed is required',
    range: 'Substitutes allowed must be between 0 and 11',
  },
  squadCapacity: {
    tooSmall: 'Players per team must fit Playing XI (11) plus substitutes',
  },
  poster: {
    type: 'Poster must be a JPG or PNG image',
    size: 'Poster must be under 5MB',
  },
  registrationOpenDate: {
    required: 'Registration open date is required',
  },
  registrationOpenTime: {
    required: 'Registration open time is required',
  },
  registrationCloseDate: {
    required: 'Registration close date is required',
  },
  registrationCloseTime: {
    required: 'Registration close time is required',
    beforeOpen: 'Registration must close after it opens',
  },
  auctionDate: {
    required: 'Auction date is required',
  },
  videoUploadEndDate: {
    required: 'Video upload end date is required when video is required',
  },
} as const;

export type TournamentFormFieldKey =
  | 'poster'
  | 'name'
  | 'year'
  | 'startDate'
  | 'endDate'
  | 'ballType'
  | 'citySelection'
  | 'province'
  | 'centers'
  | 'oversPerInnings'
  | 'numberOfTeams'
  | 'playersPerTeam'
  | 'substitutesAllowed'
  | 'registrationOpenDate'
  | 'registrationOpenTime'
  | 'registrationCloseDate'
  | 'registrationCloseTime'
  | 'auctionDate'
  | 'videoUploadEndDate';
