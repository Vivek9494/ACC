import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateAdminUserStatusDto {
  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}
