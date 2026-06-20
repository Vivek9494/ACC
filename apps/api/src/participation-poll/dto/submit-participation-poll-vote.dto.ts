import type { SubmitParticipationPollVoteRequest } from '@acc/types';
import { IsIn } from 'class-validator';
import { PollVoteChoice } from '@acc/types';

export class SubmitParticipationPollVoteDto implements SubmitParticipationPollVoteRequest {
  @IsIn([PollVoteChoice.In, PollVoteChoice.Out])
  choice!: PollVoteChoice;
}
