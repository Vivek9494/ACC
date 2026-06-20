import {
  formatPlayerSkillVideoSize,
  PLAYER_SKILL_VIDEO_MIME_LABELS,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../../src/components/ui/fieldStyles';
import { ApiRequestError, getMyPlayerSkillVideo } from '../../../src/lib/api';
import { uploadPlayerSkillVideoFile } from '../../../src/lib/skillVideoUpload';
import { pickVideoFromLibrary, type PickedVideoFile } from '../../../src/lib/videoPicker';
import type { PlayerSkillVideoSummary } from '@acc/types';

export default function UploadSkillVideoScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [existing, setExisting] = useState<PlayerSkillVideoSummary | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [picked, setPicked] = useState<PickedVideoFile | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setLoadingExisting(false);
      return;
    }
    void getMyPlayerSkillVideo(tournamentId)
      .then(setExisting)
      .catch(() => setExisting(null))
      .finally(() => setLoadingExisting(false));
  }, [tournamentId]);

  const pickVideo = useCallback(async () => {
    setPickError(null);
    setUploadError(null);
    setSuccess(false);
    const result = await pickVideoFromLibrary();
    if (!result.ok) {
      if (result.error !== 'Selection cancelled.') {
        setPickError(result.error);
      }
      return;
    }
    setPicked(result.file);
  }, []);

  async function onUpload(): Promise<void> {
    if (!tournamentId || !picked || uploading) {
      return;
    }
    setUploading(true);
    setUploadError(null);
    setSuccess(false);
    setProgress(0);
    try {
      const summary = await uploadPlayerSkillVideoFile(tournamentId, picked, (value) => {
        setProgress(value.fraction);
      });
      setExisting(summary);
      setPicked(null);
      setSuccess(true);
    } catch (err) {
      setUploadError(err instanceof ApiRequestError ? err.message : 'Could not upload video.');
    } finally {
      setUploading(false);
    }
  }

  const mimeLabel = picked
    ? PLAYER_SKILL_VIDEO_MIME_LABELS[picked.mimeType]
    : existing
      ? PLAYER_SKILL_VIDEO_MIME_LABELS[existing.mimeType as keyof typeof PLAYER_SKILL_VIDEO_MIME_LABELS] ??
        existing.mimeType
      : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Upload Skill Video" onBack={() => router.back()} showProfileMenu={false} />

      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-4 pb-10 pt-2">
        {loadingExisting ? (
          <ActivityIndicator color={FIELD_ORANGE} className="py-4" />
        ) : existing ? (
          <View
            className="gap-2 rounded-xl border border-outline-variant bg-secondary-container/40 px-4 py-4"
            style={INPUT_SHADOW_STYLE}
          >
            <Text className="font-sans-semibold text-sm text-on-surface">Current skill video</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              {mimeLabel} · {formatPlayerSkillVideoSize(existing.sizeBytes)} · uploaded{' '}
              {new Date(existing.uploadedAt).toLocaleDateString()}
            </Text>
            <Text className="font-sans text-xs text-on-surface-variant">
              Uploading a new video will replace this one.
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void pickVideo()}
          disabled={uploading}
          className="items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 active:opacity-90"
          style={INPUT_SHADOW_STYLE}
        >
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-secondary-container">
            <Ionicons name="cloud-upload-outline" size={32} color={FIELD_ORANGE} />
          </View>
          <Text className="font-sans-semibold text-base text-on-surface">
            {existing ? 'Tap to choose a replacement video' : 'Tap to upload video'}
          </Text>
          <Text className="mt-1 font-sans text-sm text-on-surface-variant">MP4, MOV up to 100MB</Text>
        </Pressable>

        {pickError ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{pickError}</Text>
          </View>
        ) : null}

        {picked ? (
          <View
            className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3"
            style={INPUT_SHADOW_STYLE}
          >
            <Text className="font-sans-semibold text-sm text-on-surface">
              {picked.name ?? 'Selected video'}
            </Text>
            <Text className="mt-1 font-sans text-xs text-on-surface-variant">
              {mimeLabel} · {formatPlayerSkillVideoSize(picked.sizeBytes)}
            </Text>
          </View>
        ) : null}

        {uploading ? (
          <View className="gap-2">
            <View className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <View
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </View>
            <View className="flex-row items-center justify-center gap-2">
              <ActivityIndicator color={FIELD_ORANGE} size="small" />
              <Text className="font-sans text-sm text-on-surface-variant">
                Uploading… {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        ) : null}

        {success ? (
          <View className="rounded-lg bg-secondary-container px-4 py-3">
            <Text className="font-sans-semibold text-sm text-on-secondary-container">
              Skill video uploaded successfully.
            </Text>
          </View>
        ) : null}

        {uploadError ? (
          <View className="gap-3 rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{uploadError}</Text>
            <Button
              variant="outline"
              className="h-11 w-full border-on-error-container"
              textClassName="text-primary"
              label="Retry upload"
              disabled={!picked || uploading}
              onPress={() => void onUpload()}
            />
          </View>
        ) : null}

        <Button
          variant="amber"
          className="h-14 w-full"
          label={
            uploading ? 'Uploading…' : existing ? 'Replace skill video' : 'Upload Video'
          }
          disabled={!picked || uploading}
          onPress={() => void onUpload()}
        />

        {success ? (
          <Button
            variant="outline"
            className="h-12 w-full"
            label="Done"
            onPress={() => router.back()}
          />
        ) : null}

        <View
          className="gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4"
          style={INPUT_SHADOW_STYLE}
        >
          <Text className="font-sans-semibold text-sm text-on-surface">Upload Instructions</Text>
          <Text className="font-sans text-sm leading-5 text-on-surface-variant">
            • Accepted formats: MP4 or MOV{'\n'}• Maximum file size: 100MB{'\n'}• Record in landscape
            orientation{'\n'}• Ensure clear audio and good lighting
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
