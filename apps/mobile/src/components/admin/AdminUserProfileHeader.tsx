import type { AdminUserDetail } from '@acc/types';
import { UserRole, type TournamentPlayerProfileView } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { PlayerProfileHeader } from '../tournament/player-profile/PlayerProfileHeader';
import { FIELD_ORANGE } from '../ui/fieldStyles';

export function adminUserToHeaderProfile(
  user: AdminUserDetail,
): Pick<
  TournamentPlayerProfileView,
  | 'firstName'
  | 'lastName'
  | 'profilePhotoUrl'
  | 'playerRoleLabel'
  | 'isCaptain'
  | 'isViceCaptain'
  | 'centerName'
  | 'ballTypeLabel'
> {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    profilePhotoUrl: user.profilePhotoUrl,
    centerName: user.centerName,
    playerRoleLabel: user.playerRoleLabel,
    isCaptain: user.roles.includes(UserRole.Captain),
    isViceCaptain: user.roles.includes(UserRole.ViceCaptain),
    ballTypeLabel: '',
  };
}

export interface AdminUserProfileHeaderProps {
  user: AdminUserDetail;
  onEdit?: () => void;
}

/** Shared cover banner + avatar + badges for admin user detail. */
export function AdminUserProfileHeader({
  user,
  onEdit,
}: AdminUserProfileHeaderProps): React.ReactElement {
  return (
    <View className="mb-4">
      <PlayerProfileHeader
        profile={adminUserToHeaderProfile(user)}
        centerRowTrailing={
          onEdit ? (
            <Pressable
              onPress={onEdit}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit user profile"
              className="active:opacity-70"
            >
              <Ionicons name="pencil" size={18} color={FIELD_ORANGE} />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}
