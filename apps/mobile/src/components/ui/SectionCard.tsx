import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from './Text';

export interface SectionCardProps {
  /** Orange icon rendered beside the heading. */
  icon?: ReactNode;
  heading?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Grouped section with peach background and orange border — e.g. emergency contact.
 */
export function SectionCard({
  icon,
  heading,
  children,
  className,
}: SectionCardProps): React.ReactElement {
  return (
    <View
      className={`gap-4 rounded-xl border border-[#F8C9AE] bg-[#FDF1EA] p-4 ${className ?? ''}`.trim()}
    >
      {heading ? (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
            {heading}
          </Text>
        </View>
      ) : null}
      <View className="gap-4">{children}</View>
    </View>
  );
}
