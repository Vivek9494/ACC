import '../global.css';

import { UserRole, type AuthUser } from '@acc/types';
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
import { hasCenterSevakAccess } from '../src/lib/center-sevak-access';
import { hasTeamLeadAccess } from '../src/lib/team-lead-access';
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
  'guest',
]);

/** Routes an unauthenticated guest may browse read-only (spec §2). */
function isGuestAccessibleRoute(segments: readonly string[]): boolean {
  const [root, second, third] = segments;
  if (root === 'guest') {
    return true;
  }
  if (root === 'matches' && third === 'live') {
    return true;
  }
  if (root === 'matches' && third === 'scorecard') {
    return true;
  }
  if (root === 'tournaments' && second && second !== 'new') {
    return true;
  }
  return false;
}

/** Post-login home route by role. */
function homeRouteForRole(
  user: AuthUser | null | undefined,
): '/admin' | '/club-manager' | '/captain' | '/center-sevak' | '/home' {
  if (user?.role === UserRole.Admin) {
    return '/admin';
  }
  if (user?.role === UserRole.ClubManager) {
    return '/club-manager';
  }
  if (hasTeamLeadAccess(user)) {
    return '/captain';
  }
  if (hasCenterSevakAccess(user)) {
    return '/center-sevak';
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
    const guestRoute = isGuestAccessibleRoute(segments);
    if (status === 'authenticated' && onAuthRoute) {
      router.replace(homeRouteForRole(user));
    } else if (status === 'unauthenticated' && !onAuthRoute && !guestRoute) {
      router.replace('/login');
    }
  }, [status, user, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="enter-otp" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="guest" options={{ headerShown: false }} />
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
      <Stack.Screen name="captain" options={{ headerShown: false }} />
      <Stack.Screen name="center-sevak" options={{ headerShown: false }} />
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
