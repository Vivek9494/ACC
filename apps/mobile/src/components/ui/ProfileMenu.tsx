import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentProps } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  View,
  type LayoutRectangle,
} from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { resolveMediaDisplayUrl } from '../../lib/media-url';
import { confirmActionAlert } from '../../lib/confirm-action-alert';
import { colors } from '@/theme/colors';
import {
  HEADER_PROFILE_AVATAR_INITIAL_CLASS,
  HEADER_PROFILE_AVATAR_SIZE_CLASS,
  INPUT_SHADOW_STYLE,
} from './fieldStyles';
import { Text } from './Text';

const MENU_WIDTH = 192;
const MENU_GAP = 8;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface MenuItemProps {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  destructive?: boolean;
}

function MenuItem({ label, icon, onPress, destructive = false }: MenuItemProps): React.ReactElement {
  const textClass = destructive ? 'text-secondary-900' : 'text-on-surface';
  const iconColor = destructive ? colors.secondaryDark : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 px-4 py-2.5 active:bg-surface-container-high"
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text className={`font-sans text-sm ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

/** Profile avatar with anchored dropdown (Profile, Change Password, Logout). */
export function ProfileMenu(): React.ReactElement {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<LayoutRectangle | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setMenuLayout({
        x: Math.max(16, x + width - MENU_WIDTH),
        y: y + height + MENU_GAP,
        width: MENU_WIDTH,
        height: 0,
      });
      setOpen(true);
    });
  }, []);

  const onProfile = useCallback(() => {
    close();
    router.push('/edit-profile');
  }, [close, router]);

  const onChangePassword = useCallback(() => {
    close();
    router.push('/change-password');
  }, [close, router]);

  const onLogout = useCallback(() => {
    close();
    confirmActionAlert({
      title: 'Log out?',
      message: 'You will need to sign in again to access your account.',
      confirmLabel: 'Log Out',
      onConfirm: async () => {
        await signOut();
        router.replace('/login');
      },
    });
  }, [close, router, signOut]);

  const initial = (user?.firstName ?? 'U').slice(0, 1).toUpperCase();

  const avatarUri = resolveMediaDisplayUrl(user?.profilePhotoUrl);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel="Open profile menu"
          className="active:opacity-90"
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              className={`${HEADER_PROFILE_AVATAR_SIZE_CLASS} rounded-full`}
            />
          ) : (
            <View
              className={`${HEADER_PROFILE_AVATAR_SIZE_CLASS} items-center justify-center rounded-full bg-surface-container-high`}
            >
              <Text className={HEADER_PROFILE_AVATAR_INITIAL_CLASS}>{initial}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View className="flex-1">
          <Pressable
            className="absolute inset-0"
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close profile menu"
          />
          {menuLayout ? (
            <View
              className="absolute rounded-control border border-separator bg-surface py-2"
              style={[
                INPUT_SHADOW_STYLE,
                {
                  top: menuLayout.y,
                  left: menuLayout.x,
                  width: menuLayout.width,
                },
              ]}
            >
              <MenuItem label="Profile" icon="person-outline" onPress={onProfile} />
              <View className="mx-4 bg-separator" />
              <MenuItem label="Change Password" icon="lock-closed-outline" onPress={onChangePassword} />
              <View className="mx-4 bg-separator" />
              <MenuItem label="Logout" icon="log-out-outline" onPress={onLogout} destructive />
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
