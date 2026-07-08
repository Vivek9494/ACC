import {
  BROADCAST_VALIDATION_MESSAGES,
  isValidBroadcastContent,
  type AdminBroadcastView,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE, labelClassName } from '../ui/fieldStyles';
import {
  ApiRequestError,
  getAdminBroadcast,
  postBroadcast,
  removeActiveBroadcast,
} from '../../lib/api';
import { uploadBroadcastImage } from '../../lib/imageUpload';
import { broadcastImagePickOptions, ensureUploadableUri, pickImage, type PickedImageFile } from '../../lib/imagePicker';
import { getUploadLimits } from '../../lib/upload-limits';

export interface AdminBroadcastSectionProps {
  onPosted?: () => void;
}

/** Fixed post form — message, optional image, Post broadcast. */
export function AdminBroadcastSection({ onPosted }: AdminBroadcastSectionProps): React.ReactElement {
  const [activeBroadcast, setActiveBroadcast] = useState<AdminBroadcastView | null>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImageFile | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    try {
      setActiveBroadcast(await getAdminBroadcast());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load current broadcast.');
    }
  }, []);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  async function pickImageFile(): Promise<void> {
    const limits = await getUploadLimits();
    const result = await pickImage(broadcastImagePickOptions(limits));
    if (result === null) {
      return;
    }
    if (!result.ok) {
      setImageError(result.error);
      return;
    }
    setImageError(null);
    setImage(result.file);
  }

  async function onPost(): Promise<void> {
    if (!isValidBroadcastContent(text, image != null)) {
      setError(BROADCAST_VALIDATION_MESSAGES.contentRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      let imageStorageKey: string | null = null;
      if (image) {
        const uploadUri = await ensureUploadableUri(image.uri, 'broadcast-image');
        const uploaded = await uploadBroadcastImage(uploadUri, image.sizeBytes ?? 0);
        imageStorageKey = uploaded.storageKey;
      }
      await postBroadcast(text, imageStorageKey);
      setText('');
      setImage(null);
      setSuccess('Broadcast posted. It will show on all dashboards for 24 hours.');
      await loadActive();
      onPosted?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not post broadcast.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(): Promise<void> {
    setRemoving(true);
    setError(null);
    setSuccess(null);
    try {
      await removeActiveBroadcast();
      setActiveBroadcast(null);
      setSuccess('Broadcast removed.');
      onPosted?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not remove broadcast.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <View className="gap-4">
      <Text className="font-sans text-sm text-on-surface-variant">
        Shown at the top of every signed-in user&apos;s home dashboard for 24 hours. Posting a new message
        replaces the current active banner.
      </Text>

      <View className="gap-4">
        <TextInput
          label="Message (optional if image is set)"
          value={text}
          onChangeText={setText}
          placeholder="Write your announcement…"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View className="gap-2">
          <Text className={labelClassName('brand')}>Image (optional if message is set)</Text>
          <Pressable
            onPress={() => void pickImageFile()}
            disabled={submitting}
            className="items-center justify-center rounded-control border-2 border-dashed border-outline-variant bg-surface-container-lowest px-4 py-8 active:opacity-90"
            style={INPUT_SHADOW_STYLE}
          >
            {image?.uri ? (
              <Image source={{ uri: image.uri }} className="h-32 w-full rounded-control" resizeMode="cover" />
            ) : (
              <>
                <Ionicons name="image-outline" size={32} color={FIELD_ORANGE} />
                <Text className="mt-2 font-sans text-sm text-on-surface-variant">Tap to choose an image</Text>
              </>
            )}
          </Pressable>
          {image ? (
            <Button
              variant="outline"
              className="h-10"
              label="Clear image"
              disabled={submitting}
              onPress={() => {
                setImage(null);
                setImageError(null);
              }}
            />
          ) : null}
          {imageError ? <Text className="font-sans text-sm text-primary">{imageError}</Text> : null}
        </View>
      </View>

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
      {success ? <Text className="font-sans text-sm text-secondary">{success}</Text> : null}

      <Button
        variant="amber"
        className="h-14"
        label={submitting ? 'Posting…' : 'Post broadcast'}
        disabled={submitting || removing}
        onPress={() => void onPost()}
      />

      {activeBroadcast ? (
        <Button
          variant="outline"
          className="h-11"
          label={removing ? 'Removing…' : 'Remove active broadcast'}
          disabled={removing || submitting}
          onPress={() => void onRemove()}
        />
      ) : null}
    </View>
  );
}
