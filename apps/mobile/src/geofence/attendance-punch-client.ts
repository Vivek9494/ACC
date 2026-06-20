import { loadAccessToken } from '../lib/session';

/** Background-safe auto punch — reads JWT from SecureStore (§geofence attendance). */
export async function backgroundAutoPunch(
  matchId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const token = await loadAccessToken();
  if (!token) {
    return;
  }

  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
  const capturedAt = new Date().toISOString();
  const response = await fetch(`${baseUrl}/matches/${matchId}/attendance/auto-punch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude, longitude, capturedAt }),
  });

  if (!response.ok) {
    console.log('[attendance] background auto-punch failed', response.status);
  }
}
