import type { ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, View } from 'react-native';

import { Button, type ButtonVariant } from './Button';
import { Text } from './Text';

export interface TabEmptyStateProps {
  /** Centered illustration (Matches, Teams, Groups tabs). */
  image?: ImageSourcePropType;
  /** Optional vector icon instead of an illustration (e.g. Leaderboard trophy). */
  icon?: ReactNode;
  message?: string;
  buttonLabel?: string;
  onPress?: () => void;
  buttonVariant?: ButtonVariant;
}

/**
 * Shared empty-state layout for tournament detail tabs — centered illustration or icon
 * with an optional message and/or action button.
 */
export function TabEmptyState({
  image,
  icon,
  message,
  buttonLabel,
  onPress,
  buttonVariant = 'primary',
}: TabEmptyStateProps): React.ReactElement {
  const showButton = Boolean(buttonLabel && onPress);

  return (
    <View className="items-center px-6 py-12">
      {icon ? (
        <View className="h-40 w-40 items-center justify-center">{icon}</View>
      ) : image ? (
        <Image
          source={image}
          className="h-40 w-40"
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {showButton ? (
        <Button
          variant={buttonVariant}
          label={buttonLabel}
          onPress={onPress}
          className="mt-8 h-12 w-full max-w-xs"
        />
      ) : message ? (
        <Text className="mt-8 text-center font-sans text-base text-on-surface-variant opacity-60">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
