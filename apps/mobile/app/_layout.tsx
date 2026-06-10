import '../global.css';

import { UserRole } from '@acc/types';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/lib/auth-context';
// THROWAWAY geofence spike: side-effect import registers the background task at
// startup so the OS can relaunch into it after a kill (see geofence-task.ts).
import '../src/geofence/geofence-task';

void SplashScreen.preventAutoHideAsync();

const AUTH_ROUTES = new Set([
  undefined,
  'index',
  'login',
  'signup',
  'forgot-password',
  'enter-otp',
  'reset-password',
]);

/** Post-login home route by role. */
function homeRouteForRole(role: UserRole | undefined): '/admin' | '/club-manager' | '/home' {
  if (role === UserRole.Admin) {
    return '/admin';
  }
  if (role === UserRole.ClubManager) {
    return '/club-manager';
  }
  return '/home';
}

/** Redirects between the auth screens and the app based on session state. */
function RootNavigator(): React.ReactElement {
  const { status, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    const onAuthRoute = AUTH_ROUTES.has(segments[0]);
    if (status === 'authenticated' && onAuthRoute) {
      router.replace(homeRouteForRole(user?.role));
    } else if (status === 'unauthenticated' && !onAuthRoute) {
      router.replace('/login');
    }
  }, [status, user?.role, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="enter-otp" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="home" />
      <Stack.Screen name="tournaments/index" />
      <Stack.Screen name="tournaments/new" />
      <Stack.Screen name="tournaments/[id]" />
      <Stack.Screen name="registrations/[tournamentId]/index" />
      <Stack.Screen name="registrations/[tournamentId]/queue" />
      <Stack.Screen name="registrations/[tournamentId]/players" />
      <Stack.Screen name="matches/new" />
      <Stack.Screen name="matches/[matchId]/index" />
      <Stack.Screen name="matches/[matchId]/playing-xi" />
      <Stack.Screen name="matches/[matchId]/toss" />
      <Stack.Screen name="matches/[matchId]/score" />
      <Stack.Screen name="matches/[matchId]/live" />
      <Stack.Screen name="matches/[matchId]/scorecard" />
      <Stack.Screen name="geofence-poc" />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="club-manager" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout(): React.ReactElement | null {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
