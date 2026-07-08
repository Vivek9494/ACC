import { View } from 'react-native';

import { useAuth } from '../../lib/auth-context';
import { BirthdayHeaderButton } from './BirthdayHeaderButton';
import { BroadcastMessageHeaderButton } from './BroadcastMessageHeaderButton';
import { ProfileMenu } from './ProfileMenu';
import { Text } from './Text';

export interface DashboardHeaderProps {
  /** Shown when the user record is not yet loaded. */
  fallbackName?: string;
}

/** Greeting row with profile menu — shared across dashboards. */
export function DashboardHeader({ fallbackName = 'User' }: DashboardHeaderProps): React.ReactElement {
  const { user } = useAuth();

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 gap-1">
        <Text className="font-sans text-base text-on-surface-variant">Jay Swaminarayan,</Text>
        <Text className="font-sans-bold text-2xl text-primary">
          {user?.firstName ?? fallbackName}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <BirthdayHeaderButton />
        <BroadcastMessageHeaderButton />
        <ProfileMenu />
      </View>
    </View>
  );
}
