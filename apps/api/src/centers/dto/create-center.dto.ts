import type { CreateCenterRequest } from '@acc/types';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCenterDto implements CreateCenterRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsUUID()
  provinceId!: string;
}
