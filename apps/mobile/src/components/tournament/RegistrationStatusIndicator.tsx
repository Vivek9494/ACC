import { View } from 'react-native';

import type { RegistrationStatusIndicatorVariant } from '../../lib/tournament-registration-cta';
import { Text } from '../ui/Text';

const VARIANT_CONTAINER: Record<RegistrationStatusIndicatorVariant, string> = {
  waitlist: 'bg-stone-200',
  confirmed: 'bg-primary',
  declined: 'border border-secondary-700 bg-surface-muted',
};

const VARIANT_TEXT: Record<RegistrationStatusIndicatorVariant, string> = {
  waitlist: 'text-stone-700',
  confirmed: 'text-text-inverse',
  declined: 'text-secondary-900',
};

export interface RegistrationStatusIndicatorProps {
  label: string;
  variant: RegistrationStatusIndicatorVariant;
  className?: string;
}

/** Non-interactive registration status bar on tournament details (§7.3). */
export function RegistrationStatusIndicator({
  label,
  variant,
  className,
}: RegistrationStatusIndicatorProps): React.ReactElement {
  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={label}
      className={`h-14 w-full items-center justify-center rounded-control ${VARIANT_CONTAINER[variant]} ${className ?? ''}`.trim()}
    >
      <Text className={`font-sans-semibold text-sm ${VARIANT_TEXT[variant]}`}>{label}</Text>
    </View>
  );
}
