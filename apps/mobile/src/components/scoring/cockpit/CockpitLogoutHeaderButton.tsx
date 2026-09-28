import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useAuth } from '../../../lib/auth-context';
import { confirmActionAlert } from '../../../lib/confirm-action-alert';
import { FIELD_ORANGE } from '../../ui/fieldStyles';

/** ASC Broadcast cockpit header: sign out and return to the /login gate. */
export function CockpitLogoutHeaderButton(): React.ReactElement {
  const router = useRouter();
  const { signOut } = useAuth();

  function onPress(): void {
    confirmActionAlert({
      title: 'Log out?',
      message: 'The next scorer will need to sign in.',
      confirmLabel: 'Log Out',
      onConfirm: async () => {
        await signOut();
        router.replace('/login');
      },
    });
  }

  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:bg-black/5 web:hover:bg-black/5"
      accessibilityRole="button"
      accessibilityLabel="Log out"
    >
      <Ionicons name="log-out-outline" size={24} color={FIELD_ORANGE} />
    </Pressable>
  );
}
