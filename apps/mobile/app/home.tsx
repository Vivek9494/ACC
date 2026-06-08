import { UserRole } from '@acc/types';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/lib/auth-context';

export default function HomeScreen(): React.ReactElement {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 justify-between px-6 py-12">
        <View className="mt-8 gap-3">
          <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
            Signed in
          </Text>
          <Text className="font-sans-bold text-3xl text-on-surface">
            {user ? `Hi, ${user.firstName}` : 'Welcome'}
          </Text>
          {user ? (
            <View className="mt-4 gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <Text className="font-sans text-sm text-on-surface-variant">
                Mobile: <Text className="text-on-surface">{user.mobileNumber}</Text>
              </Text>
              <Text className="font-sans text-sm text-on-surface-variant">
                Email: <Text className="text-on-surface">{user.email}</Text>
              </Text>
              <Text className="font-sans text-sm text-on-surface-variant">
                Jersey #: <Text className="text-on-surface">{user.jerseyNumber}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-3">
          {user?.role === UserRole.Admin ? (
            <Button
              onPress={() => router.push('/admin/provinces')}
              variant="outline"
              className="h-14 border-primary"
              textClassName="font-sans-medium text-sm uppercase tracking-wider text-primary"
              label="Provinces & Centers"
            />
          ) : null}
          <Button
            onPress={() => router.push('/tournaments')}
            className="h-14"
            textClassName="font-sans-medium text-sm uppercase tracking-wider"
            label="Tournaments"
          />
          {/* THROWAWAY: geofence attendance spike — remove after sign-off. */}
          <Button
            onPress={() => router.push('/geofence-poc')}
            variant="outline"
            className="h-14 border-primary"
            textClassName="font-sans-medium text-sm uppercase tracking-wider text-primary"
            label="Geofence spike"
          />
          <Button
            onPress={() => void signOut()}
            variant="outline"
            className="h-14"
            textClassName="font-sans-medium text-sm uppercase tracking-wider"
            label="Log out"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
