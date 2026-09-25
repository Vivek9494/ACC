import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { useAuth } from '../../lib/auth-context';
import { ProfileMenu } from './ProfileMenu';
import { BirthdayHeaderButton } from './BirthdayHeaderButton';
import { BroadcastMessageHeaderButton } from './BroadcastMessageHeaderButton';
import { Text } from './Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from './fieldStyles';

export interface ScreenHeaderProps {
  onBack?: () => void;
  /** Optional title below the icon row (e.g. screen name). */
  title?: string;
  /** Optional action on the title row, right-aligned (e.g. add button). */
  titleTrailing?: ReactNode;
  /** Optional helper line under the title. */
  subtitle?: string;
  /** When true, title uses brand orange (e.g. Poll Results). */
  accentTitle?: boolean;
  /** When false, omits the back arrow (tab roots / auth). Default true. */
  showBack?: boolean;
  showProfileMenu?: boolean;
  /** Optional actions rendered before the profile menu (e.g. edit icon). */
  trailing?: ReactNode;
  /** Tighter padding for dense screens (e.g. live scoring). */
  compact?: boolean;
}

const iconButtonClass = (compact: boolean): string =>
  `${compact ? 'h-9 w-9' : 'h-10 w-10'} items-center justify-center rounded-full active:bg-black/5`;

/** Standard stack header: orange back arrow + optional title + profile menu. */
export function ScreenHeader({
  onBack,
  title,
  titleTrailing,
  subtitle,
  accentTitle = false,
  showBack = true,
  showProfileMenu = true,
  trailing,
  compact = false,
}: ScreenHeaderProps): React.ReactElement {
  const router = useRouter();
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  /** Guests never see ProfileMenu ("U" fallback); same sign-in control as GuestHeader. */
  const showAuthenticatedChrome = showProfileMenu && isAuthenticated;
  const showGuestSignIn = showProfileMenu && !isAuthenticated;

  function handleBack(): void {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  }

  return (
    <View className={`gap-2 px-4 ${compact ? 'py-1' : 'py-3'}`}>
      <View className="flex-row items-center gap-2">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            className={`${iconButtonClass(compact)} shrink-0`}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
          </Pressable>
        ) : (
          <View className={`${iconButtonClass(compact)} shrink-0`} />
        )}
        <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
          {showAuthenticatedChrome ? (
            <>
              <BirthdayHeaderButton compact={compact} />
              <BroadcastMessageHeaderButton compact={compact} />
            </>
          ) : null}
          {trailing ? <View className="max-w-full shrink">{trailing}</View> : null}
          {showAuthenticatedChrome ? (
            <ProfileMenu />
          ) : showGuestSignIn ? (
            <Pressable
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              accessibilityLabel="Sign in or create account"
              className={`${iconButtonClass(compact)} shrink-0 bg-surface`}
              style={INPUT_SHADOW_STYLE}
            >
              <Ionicons
                name="person-circle-outline"
                size={compact ? 24 : 28}
                color={colors.textMuted}
              />
            </Pressable>
          ) : !trailing ? (
            <View className={compact ? 'h-9 w-9' : 'h-10 w-10'} />
          ) : null}
        </View>
      </View>
      {title || titleTrailing ? (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
          {title ? (
            <Text
              variant="screenTitle"
              numberOfLines={3}
              className={`min-w-[70%] max-w-full flex-1 font-sans-bold ${accentTitle ? 'text-primary' : 'text-on-surface'}`}
            >
              {title}
            </Text>
          ) : (
            <View className="min-w-0 flex-1" />
          )}
          {titleTrailing ? <View className="shrink-0">{titleTrailing}</View> : null}
        </View>
      ) : null}
      {subtitle ? (
        <Text className="font-sans text-sm text-on-surface-variant">{subtitle}</Text>
      ) : null}
    </View>
  );
}
