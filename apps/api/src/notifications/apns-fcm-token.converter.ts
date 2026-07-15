import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps } from 'firebase-admin/app';

import { NodeEnv } from '../config/env.validation';

interface BatchImportResultRow {
  apns_token?: string;
  status?: string;
  registration_token?: string;
}

interface BatchImportResponse {
  results?: BatchImportResultRow[];
}

/**
 * iOS clients using expo-notifications return an APNs device token from
 * getDevicePushTokenAsync(). FCM Admin multicast only accepts FCM registration
 * tokens. This service maps APNs → FCM via Google's Instance ID batchImport
 * (requires APNs auth key already uploaded to the Firebase iOS app).
 */
@Injectable()
export class ApnsFcmTokenConverter {
  private readonly logger = new Logger(ApnsFcmTokenConverter.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * APNs device tokens are hex (classically 64 chars; some devices longer).
   * FCM registration tokens always contain a colon.
   */
  looksLikeApnsToken(token: string): boolean {
    return /^[0-9a-fA-F]{64,}$/.test(token);
  }

  /**
   * Convert one APNs token to an FCM registration token, or null when FCM is
   * stubbed / conversion fails.
   */
  async toFcmRegistrationToken(apnsToken: string): Promise<string | null> {
    const apps = getApps();
    const app = apps[0];
    if (!app?.options.credential) {
      this.logger.warn(
        'Cannot convert APNs→FCM: Firebase app not initialized (FCM stubbed or missing credentials).',
      );
      return null;
    }

    try {
      const { access_token: accessToken } = await app.options.credential.getAccessToken();
      if (!accessToken) {
        this.logger.error('APNs→FCM conversion failed: empty OAuth access token');
        return null;
      }

      const bundleId =
        this.config.get<string>('IOS_BUNDLE_ID')?.trim() || 'com.atmiya.acc';
      const sandbox = this.resolveSandbox();

      const response = await fetch('https://iid.googleapis.com/iid/v1:batchImport', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          access_token_auth: 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          application: bundleId,
          sandbox,
          apns_tokens: [apnsToken],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `APNs→FCM batchImport HTTP ${response.status}: ${body.slice(0, 500)}`,
        );
        return null;
      }

      const payload = (await response.json()) as BatchImportResponse;
      const row = payload.results?.[0];
      if (!row || row.status !== 'OK' || typeof row.registration_token !== 'string') {
        this.logger.error(
          `APNs→FCM batchImport did not return OK: ${JSON.stringify(row ?? payload).slice(0, 500)}`,
        );
        return null;
      }

      return row.registration_token;
    } catch (err) {
      this.logger.error('APNs→FCM conversion threw', err as Error);
      return null;
    }
  }

  private resolveSandbox(): boolean {
    const raw = this.config.get<string>('FCM_APNS_SANDBOX')?.trim().toLowerCase();
    if (raw === 'true' || raw === '1') {
      return true;
    }
    if (raw === 'false' || raw === '0') {
      return false;
    }
    // TestFlight / App Store use the production APNs environment.
    return this.config.get<NodeEnv>('NODE_ENV') !== NodeEnv.Production;
  }
}
