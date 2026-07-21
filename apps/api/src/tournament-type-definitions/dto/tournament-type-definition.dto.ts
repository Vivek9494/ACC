import { BallType } from '@acc/types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTournamentTypeDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code?: string;

  @IsUUID()
  provinceId!: string;

  @IsEnum(BallType)
  ballType!: BallType;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  centerIds!: string[];

  @IsOptional()
  formatConfig?: unknown;
}

export class UpdateTournamentTypeDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @IsOptional()
  @IsEnum(BallType)
  ballType?: BallType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Type(() => String)
  centerIds?: string[];

  @IsOptional()
  formatConfig?: unknown;
}
