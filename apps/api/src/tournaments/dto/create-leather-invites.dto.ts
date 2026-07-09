import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Body for POST /tournaments/:tournamentId/leather-invites */
export class CreateLeatherInvitesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
