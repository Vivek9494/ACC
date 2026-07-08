import { SetMetadata } from '@nestjs/common';

export const ALLOW_MUST_CHANGE_PASSWORD_KEY = 'allowMustChangePassword';

/** Routes reachable while `mustChangePassword` is set (e.g. forced password change). */
export const AllowMustChangePassword = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_MUST_CHANGE_PASSWORD_KEY, true);
