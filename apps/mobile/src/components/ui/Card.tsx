import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { INPUT_SHADOW_STYLE } from './fieldStyles';

export interface CardProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  /** Renders a primary-orange left accent bar. */
  accent?: boolean;
  className?: string;
}

/** White elevated surface used across dashboard sections. */
export function Card({
  children,
  accent = false,
  className,
  onPress,
  disabled,
  ...props
}: CardProps): React.ReactElement {
  const shell = (
    <View
      className={`rounded-2xl bg-white p-4 ${accent ? 'border-l-4 border-l-primary' : ''} ${className ?? ''}`.trim()}
      style={INPUT_SHADOW_STYLE}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        className="active:opacity-90"
        {...props}
      >
        {shell}
      </Pressable>
    );
  }

  return shell;
}
