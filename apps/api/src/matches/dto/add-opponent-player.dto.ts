import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddOpponentPlayerDto {
  @IsString()
  @IsNotEmpty({ message: 'Enter a player name' })
  @MaxLength(120)
  name!: string;
}
