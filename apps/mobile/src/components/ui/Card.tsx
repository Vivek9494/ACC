import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { INPUT_SHADOW_STYLE } from './fieldStyles';

/** Default {@link Card} corner radius — reuse on chrome that should match cards. */
export const CARD_DEFAULT_RADIUS_CLASS = 'rounded-2xl';

/** Default {@link Card} stroke — reuse on chrome that should match cards. */
export const CARD_BORDER_CLASS = 'border border-border';

/** Radius + stroke shared by default cards and matching chrome. */
export const CARD_SHELL_CHROME_CLASS = `${CARD_DEFAULT_RADIUS_CLASS} ${CARD_BORDER_CLASS}`;

/** Default {@link Card} elevation — reuse on chrome that should match cards. */
export const CARD_ELEVATION_STYLE = INPUT_SHADOW_STYLE;

export interface CardProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  /** Renders a primary-orange left accent bar. */
  accent?: boolean;
  className?: string;
}

function stripRadius(className?: string): string {
  if (!className) {
    return '';
  }
  return className.replace(/\brounded-[\w[\]-]+\b/g, '').replace(/\s+/g, ' ').trim();
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
  const restClass = stripRadius(className);
  const radiusClass = className?.includes('rounded-control')
    ? 'rounded-control'
    : CARD_DEFAULT_RADIUS_CLASS;
  const shell = (
    <View
      className={`${radiusClass} bg-surface p-4 ${accent ? 'border-l-4 border-l-primary' : ''} ${restClass}`.trim()}
      style={CARD_ELEVATION_STYLE}
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
