import { TournamentState, type TransitionStateRequest } from '@acc/types';
import { IsIn } from 'class-validator';

const STATES = Object.values(TournamentState);

export class TransitionStateDto implements TransitionStateRequest {
  @IsIn(STATES)
  state!: TournamentState;
}
