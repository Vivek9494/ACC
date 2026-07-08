import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, View } from 'react-native';

import { Button, type ButtonVariant } from './Button';
import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

/** 128px circle (`h-32 w-32`) — shared tab empty-state icon shell. */
export const TAB_EMPTY_STATE_ICON_CIRCLE_SIZE_PX = 128;

/** Glyph ~50% of circle diameter — comfortable padding inside the circle. */
export const TAB_EMPTY_STATE_ICON_GLYPH_RATIO = 0.5;

export const TAB_EMPTY_STATE_ICON_CIRCLE_CLASS =
  'h-32 w-32 items-center justify-center rounded-full bg-primary/10';

export interface TabEmptyStateIconCircleProps {
  name: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  opacity?: number;
}

/** Centered vector icon inside the soft peach circular empty-state shell. */
export function TabEmptyStateIconCircle({
  name,
  color = FIELD_ORANGE,
  opacity = 0.45,
}: TabEmptyStateIconCircleProps): React.ReactElement {
  const glyphSize = Math.round(
    TAB_EMPTY_STATE_ICON_CIRCLE_SIZE_PX * TAB_EMPTY_STATE_ICON_GLYPH_RATIO,
  );

  return (
    <View className={TAB_EMPTY_STATE_ICON_CIRCLE_CLASS}>
      <Ionicons name={name} size={glyphSize} color={color} style={{ opacity }} />
    </View>
  );
}

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
