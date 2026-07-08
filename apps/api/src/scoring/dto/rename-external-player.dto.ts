import type { UpdateOpponentPlayerRequest } from '@acc/types';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameExternalPlayerDto implements UpdateOpponentPlayerRequest {
  @IsString()
  @IsNotEmpty({ message: 'Enter a player name' })
  @MaxLength(120)
  name!: string;
}
