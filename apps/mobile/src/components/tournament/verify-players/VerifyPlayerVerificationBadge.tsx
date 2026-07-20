import { Ionicons } from '@expo/vector-icons';
import { RegistrationStatus, type RegistrationStatus as RegistrationStatusType } from '@acc/types';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { Text } from '../../ui/Text';

/** Post-window verification status pill — distinct from the Approve action button. */
export function VerifyPlayerVerificationBadge({
  status,
}: {
  status: RegistrationStatusType;
}): React.ReactElement | null {
  if (status === RegistrationStatus.Confirmed) {
    return (
      <View
        className="flex-row items-center gap-1 self-start rounded-full bg-primary-100 px-2.5 py-1"
        accessibilityRole="text"
        accessibilityLabel="Verified"
      >
        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
        <Text className="font-sans-semibold text-xs text-primary-700">Verified</Text>
      </View>
    );
  }

  if (status === RegistrationStatus.InWaitlist) {
    return (
      <View
        className="flex-row items-center gap-1 self-start rounded-full bg-primary-300/25 px-2.5 py-1"
        accessibilityRole="text"
        accessibilityLabel="Pending verification"
      >
        <Ionicons name="time-outline" size={14} color={colors.primaryDark} />
        <Text className="font-sans-semibold text-xs text-primary-800">Pending</Text>
      </View>
    );
  }

  return null;
}
