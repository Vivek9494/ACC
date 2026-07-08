import type { PressableProps } from 'react-native';

import { CircularHeaderIconButton } from './CircularHeaderIconButton';

export interface CircularAddButtonProps extends Omit<PressableProps, 'children'> {
  accessibilityLabel?: string;
  iconSize?: number;
  className?: string;
}

/** Primary orange circular "+" — dashboard section headers (Add tournament, etc.). */
export function CircularAddButton({
  accessibilityLabel = 'Add',
  iconSize = 24,
  className,
  ...props
}: CircularAddButtonProps): React.ReactElement {
  return (
    <CircularHeaderIconButton
      icon="add"
      accessibilityLabel={accessibilityLabel}
      iconSize={iconSize}
      className={className}
      {...props}
    />
  );
}
