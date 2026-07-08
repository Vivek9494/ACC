/**
 * FCM device-token registration (§17). Best-effort: obtains this device's native
 * push token and registers it with the API so the shared notification service
 * can target the user. Never throws into the auth flow — a simulator, denied
 * permission, or missing native Firebase config simply results in no token.
 *
 * NATIVE SETUP: real tokens require a dev/production build with Firebase
 * configured (google-services.json for Android, GoogleService-Info.plist + APNs
 * for iOS). In Expo Go / the simulator this no-ops.
 */
import { PushPlatform, type RegisterPushTokenRequest } from '@acc/types';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from './api';

/** Remembered so we can unregister the exact token on logout. */
let lastRegisteredToken: string | null = null;

function currentPlatform(): PushPlatform {
  if (Platform.OS === 'ios') {
    return PushPlatform.Ios;
  }
  if (Platform.OS === 'android') {
    return PushPlatform.Android;
  }
  return PushPlatform.Web;
}

async function resolveDeviceToken(): Promise<string | null> {
  // Physical device only; push tokens are not issued on simulators/emulators.
  if (!Device.isDevice) {
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    return null;
  }

  const { data } = await Notifications.getDevicePushTokenAsync();
  return typeof data === 'string' ? data : null;
}

/**
 * Register this device for push after a successful sign-in. Safe to call on
 * every login; the server upserts by token.
 */
export async function registerDeviceForPush(): Promise<void> {
  try {
    const token = await resolveDeviceToken();
    if (!token) {
      return;
    }
    const body: RegisterPushTokenRequest = { token, platform: currentPlatform() };
    await registerPushToken(body);
    lastRegisteredToken = token;
  } catch {
    // Best-effort; push registration must never block or break auth.
  }
}

/** Unregister this device's token on logout (best-effort). */
export async function unregisterDeviceForPush(): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) {
    return;
  }
  try {
    await unregisterPushToken({ token });
  } catch {
    // Ignore — server prunes invalid tokens on send anyway.
  } finally {
    lastRegisteredToken = null;
  }
}
