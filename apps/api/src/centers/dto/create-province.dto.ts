import type { CreateProvinceRequest } from '@acc/types';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProvinceDto implements CreateProvinceRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
