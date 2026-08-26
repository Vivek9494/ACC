import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Key-value persistence: Keychain/Keystore on native, localStorage on web.
 * Auth v1 on desktop web uses localStorage (not httpOnly cookies).
 */

async function webGet(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

async function webSet(key: string, value: string): Promise<void> {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(key, value);
}

async function webDelete(key: string): Promise<void> {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(key);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webGet(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webSet(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webDelete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
