import { IsString, MaxLength } from 'class-validator';

export class ResolveMapsLinkQueryDto {
  @IsString()
  @MaxLength(2048)
  url!: string;
}
