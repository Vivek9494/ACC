import { RegistrationStatus, type RegistrationStatus as RegistrationStatusType } from '@acc/types';
import { Image, View } from 'react-native';

import { Text } from '../../ui/Text';

const STATUS_DOT: Partial<Record<RegistrationStatusType, string>> = {
  [RegistrationStatus.InWaitlist]: 'bg-secondary-900',
  [RegistrationStatus.Confirmed]: 'bg-primary',
  [RegistrationStatus.Declined]: 'bg-on-surface-variant',
};

export function PlayerAvatarWithStatus({
  firstName,
  profilePhotoUrl,
  status,
  size = 'md',
}: {
  firstName: string;
  profilePhotoUrl: string | null;
  status?: RegistrationStatusType | null;
  size?: 'md' | 'sm';
}): React.ReactElement {
  const dimension = size === 'md' ? 'h-14 w-14' : 'h-12 w-12';
  const dotSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const initial = firstName.slice(0, 1).toUpperCase();

  return (
    <View className={`relative ${dimension}`}>
      {profilePhotoUrl ? (
        <Image source={{ uri: profilePhotoUrl }} className={`${dimension} rounded-full`} />
      ) : (
        <View
          className={`${dimension} items-center justify-center rounded-full bg-surface-container-high`}
        >
          <Text className="font-sans-bold text-lg text-primary">{initial}</Text>
        </View>
      )}
      {status ? (
        <View
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full border-2 border-surface ${STATUS_DOT[status] ?? 'bg-stone-400'}`}
        />
      ) : null}
    </View>
  );
}
