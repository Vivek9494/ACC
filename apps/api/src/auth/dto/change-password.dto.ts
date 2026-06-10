import { CHANGE_PASSWORD_MESSAGES, type ChangePasswordRequest } from '@acc/types';
import { IsNotEmpty, IsString } from 'class-validator';

import { IsPasswordPolicy } from '../validators/is-password-policy.decorator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @IsNotEmpty({ message: CHANGE_PASSWORD_MESSAGES.currentRequired })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @IsPasswordPolicy()
  newPassword!: string;
}
