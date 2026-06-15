import { View } from 'react-native';

import type { RegistrationStatusIndicatorVariant } from '../../lib/tournament-registration-cta';
import { Text } from '../ui/Text';

const VARIANT_CONTAINER: Record<RegistrationStatusIndicatorVariant, string> = {
  waitlist: 'bg-[#FFAB4D]',
  confirmed: 'bg-[#16a34a]',
  declined: 'border border-[#c1121f]/25 bg-surface-container-high',
};

const VARIANT_TEXT: Record<RegistrationStatusIndicatorVariant, string> = {
  waitlist: 'text-on-primary',
  confirmed: 'text-white',
  declined: 'text-[#c1121f]',
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
