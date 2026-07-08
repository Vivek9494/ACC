import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { colors } from '@/theme/colors';

import {
  HEADER_PROFILE_AVATAR_ICON_SIZE,
  HEADER_PROFILE_AVATAR_SIZE_CLASS,
} from './fieldStyles';

export type CircularHeaderIconButtonSize = 'default' | 'profileAvatar';

const CIRCLE_SIZE_CLASS: Record<CircularHeaderIconButtonSize, string> = {
  default: 'h-10 w-10',
  profileAvatar: HEADER_PROFILE_AVATAR_SIZE_CLASS,
};

const DEFAULT_ICON_SIZE: Record<CircularHeaderIconButtonSize, number> = {
  default: 24,
  profileAvatar: HEADER_PROFILE_AVATAR_ICON_SIZE,
};

export interface CircularHeaderIconButtonProps extends Omit<PressableProps, 'children'> {
  icon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  /** `profileAvatar` matches {@link ProfileMenu} circle diameter and glyph weight. */
  size?: CircularHeaderIconButtonSize;
  iconSize?: number;
  className?: string;
}

/** Primary orange circular header action — edit, add, etc. */
export function CircularHeaderIconButton({
  icon,
  accessibilityLabel,
  size = 'default',
  iconSize,
  className,
  ...props
}: CircularHeaderIconButtonProps): React.ReactElement {
  const resolvedIconSize = iconSize ?? DEFAULT_ICON_SIZE[size];
  const mergedClassName = [
    `${CIRCLE_SIZE_CLASS[size]} items-center justify-center rounded-full bg-primary active:opacity-80`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={mergedClassName}
      {...props}
    >
      <Ionicons name={icon} size={resolvedIconSize} color={colors.textInverse} />
    </Pressable>
  );
}
