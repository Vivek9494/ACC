import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { FIELD_ORANGE } from './fieldStyles';

export interface ListRowIconButtonProps extends Omit<PressableProps, 'children'> {
  icon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  iconSize?: number;
  disabled?: boolean;
}

/** Compact circular icon action on list rows (edit, delete, etc.). */
export function ListRowIconButton({
  icon,
  accessibilityLabel,
  iconSize = 20,
  disabled = false,
  className,
  ...props
}: ListRowIconButtonProps): React.ReactElement {
  const mergedClassName = [
    'h-9 w-9 items-center justify-center rounded-full bg-surface-container-high active:opacity-70',
    disabled ? 'opacity-40' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      className={mergedClassName}
      {...props}
    >
      <Ionicons name={icon} size={iconSize} color={FIELD_ORANGE} />
    </Pressable>
  );
}
