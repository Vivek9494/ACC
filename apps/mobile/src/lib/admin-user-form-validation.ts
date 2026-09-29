import { mapAdminUserApiErrorToFields, type AdminUserFieldErrors } from '@acc/types';

import type { ApiRequestError } from './api';

export {
  ADMIN_USER_CREATE_FIELD_ORDER,
  ADMIN_USER_EDIT_FIELD_ORDER,
  firstAdminUserFieldError,
  validateAdminUserCreateForm,
  validateAdminUserEditForm,
  type AdminUserCreateFormValues,
  type AdminUserEditFormValues,
  type AdminUserFieldErrors,
  type AdminUserFieldKey,
} from '@acc/types';

export function mapApiErrorsToAdminUserFields(err: ApiRequestError): AdminUserFieldErrors {
  return mapAdminUserApiErrorToFields(err.error);
}
