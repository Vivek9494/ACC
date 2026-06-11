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

/** Normalize a validated 10-digit local number for storage/API (+1 prefix). */
export function profileMobileForStorage(tenDigits: string): string {
  const digits = tenDigits.replace(/\D/g, '');
  return `+1${digits}`;
}
