import { deleteSecureItem, getSecureItem, setSecureItem } from './secure-storage';

/**
 * Remember Me preferences — SecureStore on native, localStorage on web.
 */

const REMEMBER_ME_KEY = 'acc.rememberMe';
const REMEMBERED_MOBILE_KEY = 'acc.rememberedMobile';

export interface RememberMePreferences {
  rememberMe: boolean;
  /** 10-digit local number for the login field, when rememberMe and stored. */
  mobileNumber: string | null;
}

export async function loadRememberMePreferences(): Promise<RememberMePreferences> {
  const [flag, mobile] = await Promise.all([
    getSecureItem(REMEMBER_ME_KEY),
    getSecureItem(REMEMBERED_MOBILE_KEY),
  ]);
  const rememberMe = flag === '1';
  if (!rememberMe) {
    return { rememberMe: false, mobileNumber: null };
  }
  const digits = mobile?.replace(/\D/g, '') ?? '';
  const local =
    digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : null;
  return { rememberMe: true, mobileNumber: local };
}

/** Persist checkbox preference immediately (survives abandon without login). */
export async function saveRememberMeFlag(rememberMe: boolean): Promise<void> {
  if (rememberMe) {
    await setSecureItem(REMEMBER_ME_KEY, '1');
    return;
  }
  await Promise.all([
    setSecureItem(REMEMBER_ME_KEY, '0'),
    deleteSecureItem(REMEMBERED_MOBILE_KEY),
  ]);
}

/** After successful login with Remember Me checked — store 10-digit local number. */
export async function saveRememberedMobile(tenDigits: string): Promise<void> {
  await Promise.all([
    setSecureItem(REMEMBER_ME_KEY, '1'),
    setSecureItem(REMEMBERED_MOBILE_KEY, tenDigits.trim()),
  ]);
}

/** Explicit logout / uncheck — drop phone and preference. */
export async function clearRememberMePreferences(): Promise<void> {
  await Promise.all([
    deleteSecureItem(REMEMBER_ME_KEY),
    deleteSecureItem(REMEMBERED_MOBILE_KEY),
  ]);
}
