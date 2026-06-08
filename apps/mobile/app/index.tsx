import { Link } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Text } from '../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 justify-between px-6 py-12">
        <View className="mt-16 gap-3">
          <Text className="font-sans-medium text-sm uppercase tracking-widest text-primary">
            Atmiya Cricket Club
          </Text>
          <Text className="font-sans-bold text-4xl leading-tight text-on-surface">
            Welcome to ACC
          </Text>
          <Text className="font-sans text-base leading-6 text-on-surface-variant">
            Tournament management, ball-by-ball scoring, and stats for the Atmiya Cricket Club
            community.
          </Text>
        </View>

        <View className="gap-3">
          <Link href="/signup" asChild>
            <Button
              variant="primary"
              className="px-6 py-4"
              textClassName="font-sans-medium text-sm uppercase tracking-wider"
              label="Create an account"
            />
          </Link>
          <Link href="/login" asChild>
            <Button
              variant="outline"
              className="px-6 py-4"
              textClassName="font-sans-medium text-sm uppercase tracking-wider"
              label="Log in"
            />
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
