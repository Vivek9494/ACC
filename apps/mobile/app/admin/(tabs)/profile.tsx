import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';
import { useAuth } from '../../../src/lib/auth-context';

export default function AdminProfileTabScreen(): React.ReactElement {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 justify-between px-4 py-4">
        <View className="gap-4">
          <Text className="font-sans-bold text-2xl text-on-surface">Profile</Text>
          {user ? (
            <Card className="gap-2">
              <Text className="font-sans-bold text-lg text-on-surface">
                {user.firstName} {user.lastName}
              </Text>
              <Text className="font-sans text-sm text-on-surface-variant">{user.email}</Text>
              <Text className="font-sans text-sm text-on-surface-variant">{user.mobileNumber}</Text>
              <Text className="font-sans-medium text-sm text-primary">{user.role}</Text>
            </Card>
          ) : null}
        </View>
        <Button
          variant="outline"
          className="h-14"
          label="Log out"
          onPress={() => void signOut()}
        />
      </View>
    </SafeAreaView>
  );
}
