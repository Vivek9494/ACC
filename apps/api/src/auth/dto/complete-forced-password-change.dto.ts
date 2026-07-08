import { IsString, MinLength } from 'class-validator';

import { PASSWORD_MIN_LENGTH } from '@acc/types';

export class CompleteForcedPasswordChangeDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  newPassword!: string;
}
