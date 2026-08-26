import type { AdminUserSummary } from '@acc/types';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme/colors';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { OverflowMenu, type OverflowMenuAction } from '../ui/OverflowMenu';
import { Text } from '../ui/Text';
import { AdminUserRoleChips } from './AdminUserRoleChips';
import { AdminUserMobileContact } from './AdminUserMobileContact';

export interface AdminUserListCardProps {
  user: AdminUserSummary;
  onPress: () => void;
  /** When false, hides the overflow menu (view-only directory viewers). */
  showRowActions?: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
}

/** Admin directory row — tap opens detail; overflow menu for status + delete. */
export function AdminUserListCard({
  user,
  onPress,
  showRowActions = true,
  onToggleStatus,
  onDelete,
}: AdminUserListCardProps): React.ReactElement {
  const menuActions: OverflowMenuAction[] = [
    {
      key: 'status',
      label: user.isActive ? 'Inactive' : 'Active',
      icon: user.isActive ? 'pause-circle-outline' : 'checkmark-circle-outline',
      onPress: onToggleStatus,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: onDelete,
    },
  ];

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${user.firstName} ${user.lastName}`}
          className="shrink-0 active:opacity-90"
        >
          <PlayerAvatar
            firstName={user.firstName}
            profilePhotoUrl={user.profilePhotoUrl}
            size="sm"
          />
        </Pressable>
        <View className="min-w-0 flex-1 gap-1">
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            className="active:opacity-90"
          >
            <Text className="font-sans-bold text-base text-text" numberOfLines={2}>
              {user.firstName} {user.lastName}
            </Text>
          </Pressable>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <AdminUserMobileContact
              mobileNumber={user.mobileNumber}
              maskedMobileNumber={user.maskedMobileNumber}
            />
            <AdminUserRoleChips roles={user.roles} />
            {!user.isActive ? (
              <View className="rounded-full border border-primary bg-primary-50 px-2.5 py-1">
                <Text className="font-sans-semibold text-xs text-primary-800">Inactive</Text>
              </View>
            ) : null}
          </View>
        </View>
        {showRowActions ? (
          <OverflowMenu
            actions={menuActions}
            accessibilityLabel="User actions"
            iconColor={colors.primary}
          />
        ) : null}
      </View>
    </Card>
  );
}
