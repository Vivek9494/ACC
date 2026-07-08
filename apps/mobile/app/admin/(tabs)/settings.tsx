import {
  APP_SETTINGS_VALIDATION_MESSAGES,
  isMaskedAwsKeyValue,
  isValidAwsSecretAccessKey,
  isValidGoogleMapsApiKey,
  isValidImageUploadMaxMb,
  isValidVideoUploadMaxMb,
  normalizeAwsSecretAccessKey,
  normalizeGoogleMapsApiKey,
} from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  getAdminSettings,
  updateAdminSettings,
} from '../../../src/lib/api';
import { invalidateUploadLimitsCache } from '../../../src/lib/upload-limits';

export default function AdminSettingsTabScreen(): React.ReactElement {

  const [videoUploadMaxMb, setVideoUploadMaxMb] = useState('');
  const [imageUploadMaxMb, setImageUploadMaxMb] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [awsKey, setAwsKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getAdminSettings();
      setVideoUploadMaxMb(String(settings.videoUploadMaxMb));
      setImageUploadMaxMb(String(settings.imageUploadMaxMb));
      setGoogleMapsApiKey(settings.googleMapsApiKey);
      setAwsKey(settings.awsKeyMasked ?? '');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function onSave(): Promise<void> {
    const videoMb = Number.parseInt(videoUploadMaxMb.trim(), 10);
    const imageMb = Number.parseInt(imageUploadMaxMb.trim(), 10);

    if (!videoUploadMaxMb.trim()) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.videoUploadMaxMb.required);
      return;
    }
    if (!imageUploadMaxMb.trim()) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.imageUploadMaxMb.required);
      return;
    }
    if (!isValidVideoUploadMaxMb(videoMb)) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.videoUploadMaxMb.invalid);
      return;
    }
    if (!isValidImageUploadMaxMb(imageMb)) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.imageUploadMaxMb.invalid);
      return;
    }
    const mapsKey = normalizeGoogleMapsApiKey(googleMapsApiKey);
    if (!googleMapsApiKey.trim()) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.googleMapsApiKey.required);
      return;
    }
    if (!isValidGoogleMapsApiKey(mapsKey)) {
      setError(APP_SETTINGS_VALIDATION_MESSAGES.googleMapsApiKey.invalid);
      return;
    }

    const awsKeyChanged = awsKey.trim().length > 0 && !isMaskedAwsKeyValue(awsKey);
    if (awsKeyChanged) {
      const normalizedAwsKey = normalizeAwsSecretAccessKey(awsKey);
      if (!isValidAwsSecretAccessKey(normalizedAwsKey)) {
        setError(APP_SETTINGS_VALIDATION_MESSAGES.awsKey.invalid);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateAdminSettings({
        videoUploadMaxMb: videoMb,
        imageUploadMaxMb: imageMb,
        googleMapsApiKey: mapsKey,
        ...(awsKeyChanged ? { awsKey: normalizeAwsSecretAccessKey(awsKey) } : {}),
      });
      invalidateUploadLimitsCache();
      setAwsKey(updated.awsKeyMasked ?? '');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save settings.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareFormScrollView className="flex-1 px-4 py-4" contentContainerClassName="gap-5" extraBottomPadding={24}>
          <Text className="font-sans-bold text-2xl text-on-surface">Settings</Text>

          {loading ? (
            <ActivityIndicator color={FIELD_ORANGE} className="py-4" />
          ) : (
            <View className="gap-4">
              <Card className="gap-4 rounded-control">
                <Text className="font-sans-semibold text-base text-on-surface">Upload limits</Text>

                <TextInput
                  label="Video Upload Size (MB)"
                  value={videoUploadMaxMb}
                  onChangeText={setVideoUploadMaxMb}
                  placeholder="100"
                  keyboardType="number-pad"
                />

                <TextInput
                  label="Image Upload Size (MB)"
                  value={imageUploadMaxMb}
                  onChangeText={setImageUploadMaxMb}
                  placeholder="5"
                  keyboardType="number-pad"
                />
              </Card>

              <Card className="gap-4 rounded-control">
                <Text className="font-sans-semibold text-base text-on-surface">Google Maps</Text>
                <TextInput
                  label="Google Maps API Key"
                  value={googleMapsApiKey}
                  onChangeText={setGoogleMapsApiKey}
                  placeholder="AIzaSy…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Text className="font-sans text-xs leading-5 text-on-surface-variant">
                  Restrict this key in Google Cloud Console (API restrictions plus HTTP referrer or IP
                  restrictions) so a leaked key has limited use. The key is only loaded on this screen and
                  sent over HTTPS when you save.
                </Text>
              </Card>

              <Card className="gap-4 rounded-control">
                <Text className="font-sans-semibold text-base text-on-surface">AWS</Text>
                <TextInput
                  label="AWS Key"
                  value={awsKey}
                  onChangeText={setAwsKey}
                  placeholder="Secret access key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  secureTextEntry={awsKey.length > 0 && !isMaskedAwsKeyValue(awsKey)}
                />
                <Text className="font-sans text-xs leading-5 text-on-surface-variant">
                  AWS secret access key for server-side S3 uploads. Stored on the API only — never in the
                  mobile app. Leave the masked value unchanged to keep the current key; enter a new value to
                  replace it.
                </Text>
              </Card>

              {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
              {success ? (
                <Text className="font-sans text-sm text-secondary">Settings saved.</Text>
              ) : null}

              <Button
                variant="amber"
                className="h-14"
                label={submitting ? 'Saving…' : 'Save Settings'}
                disabled={submitting}
                onPress={() => void onSave()}
              />
            </View>
          )}
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
