import { BattingStyle } from '@acc/types';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const BATTING_STYLES = Object.values(BattingStyle);

/** Body for adding a name-only external opponent batter (§9.5). */
export class AddExternalBatsmanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsIn(BATTING_STYLES)
  battingStyle?: BattingStyle | null;
}
