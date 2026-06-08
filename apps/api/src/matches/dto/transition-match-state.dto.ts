import { MatchState, type TransitionMatchStateRequest } from '@acc/types';
import { IsIn } from 'class-validator';

const STATES = Object.values(MatchState);

export class TransitionMatchStateDto implements TransitionMatchStateRequest {
  @IsIn(STATES)
  state!: MatchState;
}
