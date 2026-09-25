import { ADMIN_USER_ROLE_LABELS, UserRole, type UserRole as UserRoleType } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';

/** Global roles that warrant a directory badge — Player and Cap/VC/Manager do not. */
const DIRECTORY_BADGE_ROLES: ReadonlySet<UserRoleType> = new Set([
  UserRole.Admin,
  UserRole.ClubManager,
  UserRole.CenterSevak,
]);

export interface AdminUserRoleChipsProps {
  roles: UserRoleType[];
  /** `sm` for list rows; `md` for detail header. */
  size?: 'sm' | 'md';
}

function chipClassName(role: UserRoleType): string {
  if (role === UserRole.Admin || role === UserRole.ClubManager) {
    return 'border border-secondary bg-secondary-50 text-secondary-800';
  }
  if (role === UserRole.CenterSevak) {
    return 'bg-secondary-100 text-secondary-800';
  }
  return 'bg-stone-200 text-stone-700';
}

/** Compact role chips for the admin user directory (platform leadership roles only). */
export function AdminUserRoleChips({
  roles,
  size = 'sm',
}: AdminUserRoleChipsProps): React.ReactElement | null {
  const badgeRoles = roles.filter((role) => DIRECTORY_BADGE_ROLES.has(role));
  if (badgeRoles.length === 0) {
    return null;
  }

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {badgeRoles.map((role) => (
        <View
          key={role}
          className={`rounded-full ${padding} ${chipClassName(role)}`}
        >
          <Text className={`font-sans-semibold ${textSize}`}>
            {ADMIN_USER_ROLE_LABELS[role]}
          </Text>
        </View>
      ))}
    </View>
  );
}
