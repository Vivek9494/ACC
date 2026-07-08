import { TOURNAMENT_SCORER_COUNT, type SetTournamentScorersRequest } from '@acc/types';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetTournamentScorersDto implements SetTournamentScorersRequest {
  @IsArray()
  @ArrayMinSize(TOURNAMENT_SCORER_COUNT)
  @ArrayMaxSize(TOURNAMENT_SCORER_COUNT)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
