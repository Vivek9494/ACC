import type { GenerateKnockoutBracketRequest } from '@acc/types';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class GenerateKnockoutBracketDto implements GenerateKnockoutBracketRequest {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}
