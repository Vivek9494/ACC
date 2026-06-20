import type { AdminUserSummary } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { AdminUserRoleChips } from './AdminUserRoleChips';

export interface AdminUserListCardProps {
  user: AdminUserSummary;
  onPress: () => void;
}

/** Admin directory row — avatar, name, masked mobile, role chips. */
export function AdminUserListCard({
  user,
  onPress,
}: AdminUserListCardProps): React.ReactElement {
  return (
    <Card onPress={onPress} className="gap-3">
      <View className="flex-row items-center gap-3">
        <PlayerAvatar
          firstName={user.firstName}
          profilePhotoUrl={user.profilePhotoUrl}
          size="sm"
        />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-sans-bold text-base text-text" numberOfLines={2}>
              {user.firstName} {user.lastName}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
          <Text className="font-sans text-sm text-text-muted">{user.maskedMobileNumber}</Text>
          {!user.isActive ? (
            <Text className="font-sans-semibold text-xs text-secondary-800">Inactive</Text>
          ) : null}
        </View>
      </View>
      <AdminUserRoleChips roles={user.roles} />
    </Card>
  );
}
