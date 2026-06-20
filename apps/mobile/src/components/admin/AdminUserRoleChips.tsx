import { ADMIN_USER_ROLE_LABELS, UserRole, type UserRole as UserRoleType } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';

export interface AdminUserRoleChipsProps {
  roles: UserRoleType[];
  /** `sm` for list rows; `md` for detail header. */
  size?: 'sm' | 'md';
}

function chipClassName(role: UserRoleType): string {
  if (role === UserRole.Admin || role === UserRole.ClubManager) {
    return 'border border-secondary bg-secondary-50 text-secondary-800';
  }
  if (role === UserRole.Captain || role === UserRole.ViceCaptain) {
    return 'bg-primary-100 text-primary-800';
  }
  if (role === UserRole.CenterSevak || role === UserRole.Manager) {
    return 'bg-secondary-100 text-secondary-800';
  }
  return 'bg-stone-200 text-stone-700';
}

/** Compact role chips for the admin user directory. */
export function AdminUserRoleChips({
  roles,
  size = 'sm',
}: AdminUserRoleChipsProps): React.ReactElement {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {roles.map((role) => (
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
