import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Bulk-add confirmed unrostered registrants to a team roster. */
export class AddTeamPlayersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
