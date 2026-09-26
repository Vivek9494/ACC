import {
  DismissalType,
  InningsCloseReason,
  InningsType,
  MatchSide,
  TossDecision,
  type ScorecardSummaryBatterInput,
  type ScorecardSummaryBowlerInput,
  type ScorecardSummaryFallOfWicketInput,
  type ScorecardSummaryInningsWriteInput,
  type UpsertScorecardSummaryRequest,
} from '@acc/types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const DISMISSAL_TYPES = Object.values(DismissalType);
const CLOSE_REASONS = Object.values(InningsCloseReason);
const INNINGS_TYPES = Object.values(InningsType);
const MATCH_SIDES = Object.values(MatchSide);
const TOSS_DECISIONS = Object.values(TossDecision);

class ScorecardSummaryBatterDto implements ScorecardSummaryBatterInput {
  @IsString()
  playerId!: string;

  @IsInt()
  @Min(0)
  runs!: number;

  @IsInt()
  @Min(0)
  balls!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sixes?: number;

  @IsBoolean()
  isOut!: boolean;

  @IsOptional()
  @IsIn(DISMISSAL_TYPES)
  dismissalType?: DismissalType | null;

  @IsOptional()
  @IsString()
  bowlerId?: string | null;

  @IsOptional()
  @IsString()
  fielderId?: string | null;

  @IsOptional()
  @IsString()
  fielder2Id?: string | null;

  @IsOptional()
  @IsBoolean()
  retiredHurt?: boolean;

  @IsOptional()
  @IsBoolean()
  isMankad?: boolean;
}

class ScorecardSummaryBowlerDto implements ScorecardSummaryBowlerInput {
  @IsString()
  playerId!: string;

  @IsString()
  oversText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maidens?: number;

  @IsInt()
  @Min(0)
  runsConceded!: number;

  @IsInt()
  @Min(0)
  wickets!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  wides?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  noBalls?: number;
}

class ScorecardSummaryFallOfWicketDto implements ScorecardSummaryFallOfWicketInput {
  @IsInt()
  @Min(1)
  wicketNumber!: number;

  @IsString()
  playerId!: string;

  @IsInt()
  @Min(0)
  teamRuns!: number;

  @IsString()
  oversText!: string;
}

class ScorecardSummaryInningsWriteDto implements ScorecardSummaryInningsWriteInput {
  @IsInt()
  @Min(1)
  sequence!: number;

  @IsOptional()
  @IsIn(INNINGS_TYPES)
  inningsType?: InningsType;

  @IsOptional()
  @IsString()
  battingTeamId!: string | null;

  @IsOptional()
  @IsString()
  bowlingTeamId!: string | null;

  @IsOptional()
  @IsBoolean()
  battingIsExternal?: boolean;

  @IsOptional()
  @IsBoolean()
  bowlingIsExternal?: boolean;

  @IsInt()
  @Min(0)
  runs!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  wickets!: number;

  @IsString()
  oversText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  oversAllotted?: number | null;

  @IsOptional()
  @IsBoolean()
  closed?: boolean;

  @IsOptional()
  @IsIn(CLOSE_REASONS)
  closeReason?: InningsCloseReason | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  target?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasByes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasLegByes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasWides?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasNoBalls?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasPenalties?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardSummaryBatterDto)
  batters!: ScorecardSummaryBatterDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardSummaryBowlerDto)
  bowlers!: ScorecardSummaryBowlerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardSummaryFallOfWicketDto)
  fallOfWickets?: ScorecardSummaryFallOfWicketDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  squadPlayerIds?: string[];
}

export class UpsertScorecardSummaryDto implements UpsertScorecardSummaryRequest {
  @IsOptional()
  @IsIn(MATCH_SIDES)
  tossWinner?: MatchSide | null;

  @IsOptional()
  @IsIn(TOSS_DECISIONS)
  tossDecision?: TossDecision | null;

  @IsOptional()
  @IsString()
  winningTeamId?: string | null;

  @IsOptional()
  @IsBoolean()
  isNoResult?: boolean;

  @IsOptional()
  @IsString()
  resultNote?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  statedHomePoints?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  statedAwayPoints?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScorecardSummaryInningsWriteDto)
  innings!: ScorecardSummaryInningsWriteDto[];
}
