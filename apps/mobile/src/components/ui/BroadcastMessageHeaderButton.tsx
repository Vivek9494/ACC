import { UserRole } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { FIELD_ORANGE } from './fieldStyles';

function broadcastManagementHref(role: UserRole): Href | null {
  if (role === UserRole.Admin) {
    return '/admin/broadcast';
  }
  if (role === UserRole.ClubManager) {
    return '/club-manager/broadcast';
  }
  return null;
}

export interface BroadcastMessageHeaderButtonProps {
  compact?: boolean;
}

/** Admin / Club Manager — opens broadcast message management (header, before profile menu). */
export function BroadcastMessageHeaderButton({
  compact = false,
}: BroadcastMessageHeaderButtonProps): React.ReactElement | null {
  const { user } = useAuth();
  const router = useRouter();
  const href = user ? broadcastManagementHref(user.role) : null;

  if (!href) {
    return null;
  }

  const sizeClass = compact ? 'h-9 w-9' : 'h-10 w-10';

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel="Broadcast message"
      className={`${sizeClass} shrink-0 items-center justify-center rounded-full active:bg-black/5`}
    >
      <Ionicons name="megaphone-outline" size={compact ? 22 : 24} color={FIELD_ORANGE} />
    </Pressable>
  );
}
