import type { AutoAttendancePunchResponse } from '@acc/types';

import { loadAccessToken, loadTokens, saveTokens } from '../lib/session';
import { geofenceLog } from './geofence-log';

/** Background-safe auto punch — uses SecureStore tokens (§geofence attendance). */
export async function backgroundAutoPunch(
  matchId: string,
  latitude: number,
  longitude: number,
  geofenceEnter = false,
): Promise<AutoAttendancePunchResponse | null> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
  const capturedAt = new Date().toISOString();
  const body = JSON.stringify({ latitude, longitude, capturedAt, geofenceEnter });

  let accessToken = await loadAccessToken();
  if (!accessToken) {
    geofenceLog('punch.write_skipped', { matchId, reason: 'no_access_token' });
    return null;
  }

  geofenceLog('punch.write_start', { matchId, latitude, longitude, geofenceEnter });

  let response = await postAutoPunch(baseUrl, matchId, accessToken, body);
  if (response.status === 401) {
    const refreshed = await refreshAccessTokenInBackground(baseUrl);
    if (!refreshed) {
      geofenceLog('punch.write_failed', { matchId, status: 401, reason: 'refresh_failed' });
      return null;
    }
    accessToken = refreshed;
    response = await postAutoPunch(baseUrl, matchId, accessToken, body);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    geofenceLog('punch.write_failed', {
      matchId,
      status: response.status,
      body: errorBody.slice(0, 200),
    });
    return null;
  }

  const result = (await response.json()) as AutoAttendancePunchResponse;
  geofenceLog('punch.write_success', {
    matchId,
    status: result.status,
    alreadyRecorded: result.alreadyRecorded,
    punchTimeUtc: result.punchTimeUtc,
  });
  return result;
}

async function postAutoPunch(
  baseUrl: string,
  matchId: string,
  accessToken: string,
  body: string,
): Promise<Response> {
  return fetch(`${baseUrl}/matches/${matchId}/attendance/auto-punch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });
}

async function refreshAccessTokenInBackground(baseUrl: string): Promise<string | null> {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    return null;
  }
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  if (!response.ok) {
    return null;
  }
  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  await saveTokens(tokens);
  return tokens.accessToken;
}
