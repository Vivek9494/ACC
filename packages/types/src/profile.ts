/**
 * Profile read/update contracts (authenticated user editing their own profile).
 */

import type { JerseySize } from './jersey-size';

/** Full profile payload for the Edit Profile screen (self only). */
export interface ProfileDetail {
  id: string;
  firstName: string;
  lastName: string;
  /** Stored format (+1XXXXXXXXXX). */
  mobileNumber: string;
  email: string;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string;
  address: string | null;
  postalCode: string | null;
  centerId: string;
  centerName: string;
  provinceId: string;
  provinceName: string;
  profilePhotoUrl: string | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  /** Sensitive health data — only returned on GET /profile for the authenticated user. */
  hasHealthCard: boolean;
  jerseyName: string | null;
  jerseySize: JerseySize | null;
  jerseyNumber: number;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  /** Selected province; the chosen center must belong to this province. */
  provinceId: string;
  centerId: string;
  email?: string;
  dateOfBirth: string;
  address?: string;
  postalCode?: string;
  profilePhotoUrl?: string | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  hasHealthCard: boolean;
  jerseyName?: string | null;
  jerseySize?: JerseySize | null;
  jerseyNumber?: number;
}

export interface RequestProfileMobileOtpRequest {
  /** Ten-digit local mobile number for the new phone. */
  newMobileNumber: string;
}

export interface UploadProfilePhotoResponse {
  storageKey: string;
  /** Presigned read URL for immediate display. Persist storageKey on the profile record. */
  profilePhotoUrl: string;
}

/** Strip +1 prefix for display/editing (10-digit local). */
export function profileMobileDisplay(stored: string): string {
  const digits = stored.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

/** Normalize a 10-digit local or +1 E.164 Canadian mobile for storage/API. */
export function normalizeCanadianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1${digits.slice(1)}`;
  }
  throw new Error('Invalid Canadian mobile number');
}

/** Mask a stored or local Canadian mobile for OTP screens: +1 (***) ***-1234. */
export function formatCanadianMobileMasked(storedOrLocal: string): string {
  const digits = storedOrLocal.replace(/\D/g, '');
  const local =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
  if (local.length !== 10) {
    return '+1 (***) ***-****';
  }
  return `+1 (***) ***-${local.slice(6)}`;
}

/** Human-readable Canadian mobile for admin contact display: +1 519-995-5472. */
export function formatCanadianMobileForDisplay(stored: string): string {
  const digits = stored.replace(/\D/g, '');
  const local =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
  if (local.length !== 10) {
    return stored.trim().length > 0 ? stored : 'No phone on file';
  }
  return `+1 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

/** Normalize a validated 10-digit local number for storage/API (+1 prefix). */
export function profileMobileForStorage(tenDigits: string): string {
  return normalizeCanadianMobile(tenDigits);
}
