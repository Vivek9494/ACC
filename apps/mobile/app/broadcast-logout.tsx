import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../src/components/ui/Text';
import { hasAscObsBridge } from '../src/lib/asc-broadcast-bridge';
import { useAuth } from '../src/lib/auth-context';
import { colors } from '@/theme/colors';

/**
 * ASC Broadcast (Electron) logout: the shell's Logout button loads this route in
 * the cockpit BrowserView, which owns the session. Same signOut as the web
 * ProfileMenu, then back to the /login launch gate. Outside Electron it never
 * signs out — it just leaves.
 */
export default function BroadcastLogoutScreen(): React.ReactElement {
  const router = useRouter();
  const { status, signOut } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    // Wait for session restore: an in-flight bootstrap would otherwise mark the
    // user authenticated again after signOut cleared the tokens.
    if (started.current || status === 'loading') {
      return;
    }
    started.current = true;
    if (!hasAscObsBridge()) {
      router.replace('/');
      return;
    }
    void (async () => {
      await signOut();
      router.replace('/login');
    })();
  }, [router, signOut, status]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator color={colors.primary} />
        <Text className="font-sans text-base text-on-surface-variant">Signing out…</Text>
      </View>
    </SafeAreaView>
  );
}
